from fastapi import APIRouter, UploadFile, File, Depends, Header
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.receipt import Receipt
from typing import Optional
import httpx
import re
import os
import uuid

router = APIRouter(prefix="/ocr", tags=["OCR"])
UPLOAD_FOLDER = "uploads"
OCR_API_KEY = os.getenv("OCR_API_KEY", "helloworld")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def parse_receipt(text: str) -> dict:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = lines[0] if lines else "Unknown Store"

    amount_matches = re.findall(r"\d+[\.,]\d{2}", text)
    amounts = []
    for m in amount_matches:
        try:
            amounts.append(float(m.replace(",", ".")))
        except:
            pass
    amount = str(max(amounts)) if amounts else "0"

    lower = text.lower()
    if any(w in lower for w in ["restaurant", "food", "cafe", "pizza", "burger", "swiggy", "zomato"]):
        category = "Food"
    elif any(w in lower for w in ["uber", "ola", "bus", "metro", "taxi", "fuel", "petrol"]):
        category = "Transport"
    elif any(w in lower for w in ["electricity", "wifi", "internet", "water", "gas", "bill", "recharge"]):
        category = "Bills"
    elif any(w in lower for w in ["hospital", "pharmacy", "medicine", "doctor", "clinic"]):
        category = "Health"
    elif any(w in lower for w in ["movie", "cinema", "netflix", "entertainment", "game"]):
        category = "Entertainment"
    elif any(w in lower for w in ["school", "college", "book", "education", "course"]):
        category = "Education"
    else:
        category = "Shopping"

    return {
        "title": title,
        "amount": amount,
        "category": category,
        "raw_text": text,
    }

def ocr_space_extract(contents: bytes, filename: str) -> str:
    """Call OCR.space API to extract text from image/PDF."""
    try:
        fname = filename.lower()
        if fname.endswith(".pdf"):
            filetype = "pdf"
        elif fname.endswith(".png"):
            filetype = "png"
        else:
            filetype = "jpg"

        with httpx.Client(timeout=30.0) as client:
            res = client.post(
                "https://api.ocr.space/parse/image",
                data={
                    "apikey": OCR_API_KEY,
                    "language": "eng",
                    "isOverlayRequired": False,
                    "detectOrientation": True,
                    "scale": True,
                    "OCREngine": 2,
                },
                files={"file": (filename, contents, f"image/{filetype}")}
            )
            data = res.json()
            if data.get("IsErroredOnProcessing"):
                print(f"OCR.space error: {data.get('ErrorMessage')}")
                return ""
            results = data.get("ParsedResults", [])
            if results:
                return results[0].get("ParsedText", "")
            return ""
    except Exception as e:
        print(f"OCR.space error: {e}")
        return ""

@router.post("/")
async def scan_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    contents = await file.read()

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    text = ocr_space_extract(contents, file.filename)

    if not text.strip():
        return {
            "id": None,
            "title": "Unknown Store",
            "amount": "0",
            "category": "Other",
            "raw_text": "Could not extract text. Try a clearer photo.",
            "image_url": f"/uploads/{filename}",
        }

    extracted = parse_receipt(text)

    receipt = Receipt(
        image_url=f"/uploads/{filename}",
        raw_text=extracted["raw_text"],
        title=extracted["title"],
        amount=extracted["amount"],
        category=extracted["category"],
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    return {
        "id": receipt.id,
        "title": extracted["title"],
        "amount": extracted["amount"],
        "category": extracted["category"],
        "raw_text": extracted["raw_text"],
        "image_url": receipt.image_url,
    }

@router.get("/history")
def get_receipts(db: Session = Depends(get_db)):
    return db.query(Receipt).order_by(Receipt.id.desc()).all()