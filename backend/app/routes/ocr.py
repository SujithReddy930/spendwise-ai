from fastapi import APIRouter, UploadFile, File, Depends, Header
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.receipt import Receipt
from typing import Optional
from PIL import Image
import pytesseract
import io
import re
import os
import uuid

router = APIRouter(prefix="/ocr", tags=["OCR"])
UPLOAD_FOLDER = "uploads"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def extract_text_from_image(contents: bytes, filename: str) -> str:
    """Extract text from image or PDF using tesseract."""
    text = ""
    try:
        if filename.lower().endswith(".pdf"):
            from pdf2image import convert_from_bytes
            pages = convert_from_bytes(contents)
            for page in pages:
                text += pytesseract.image_to_string(page)
        else:
            image = Image.open(io.BytesIO(contents))
            text = pytesseract.image_to_string(image)
    except Exception as e:
        print(f"OCR error: {e}")
        text = ""
    return text

def parse_receipt(text: str) -> dict:
    """Parse extracted text to get title, amount, category."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = lines[0] if lines else "Unknown Store"

    # Find amount — largest number with decimals
    amount_matches = re.findall(r"\d+[\.,]\d{2}", text)
    amounts = []
    for m in amount_matches:
        try:
            amounts.append(float(m.replace(",", ".")))
        except:
            pass
    amount = str(max(amounts)) if amounts else "0"

    # Detect category from keywords
    lower = text.lower()
    if any(w in lower for w in ["restaurant", "food", "cafe", "pizza", "burger", "hotel", "swiggy", "zomato"]):
        category = "Food"
    elif any(w in lower for w in ["uber", "ola", "bus", "metro", "taxi", "fuel", "petrol", "transport"]):
        category = "Transport"
    elif any(w in lower for w in ["electricity", "wifi", "internet", "water", "gas", "bill", "recharge"]):
        category = "Bills"
    elif any(w in lower for w in ["hospital", "pharmacy", "medicine", "doctor", "clinic", "health"]):
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

@router.post("/")
async def scan_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    contents = await file.read()

    # Save file
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    # Extract text
    text = extract_text_from_image(contents, file.filename)

    if not text.strip():
        return {
            "id": None,
            "title": "Unknown Store",
            "amount": "0",
            "category": "Other",
            "raw_text": "Could not extract text from image. Try a clearer photo.",
            "image_url": f"/uploads/{filename}",
        }

    # Parse receipt
    extracted = parse_receipt(text)

    # Save to DB
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