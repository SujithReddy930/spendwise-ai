# backend/app/routes/ocr.py
import os
import re
import uuid
import json
import base64
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, UploadFile, File, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from google import genai
from google.genai import types

from app.database import get_db
from app.models.receipt import Receipt
from app.core.security import decode_token

router = APIRouter(prefix="/ocr", tags=["OCR"])

UPLOAD_FOLDER = "uploads"
OCR_API_KEY = os.getenv("OCR_API_KEY", "helloworld")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
GEMINI_MODEL = "gemini-1.5-flash"


# ── Auth helper ────────────────────────────────────────────────────────────────

def get_current_user_id(authorization: Optional[str] = Header(None)) -> Optional[int]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        return None
    try:
        return int(payload.get("sub"))
    except Exception:
        return None


# ── OCR.space fallback ─────────────────────────────────────────────────────────

def ocr_space_extract(contents: bytes, filename: str) -> str:
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
                return ""
            results = data.get("ParsedResults", [])
            return results[0].get("ParsedText", "") if results else ""
    except Exception as e:
        print(f"OCR.space error: {e}")
        return ""


# ── Basic regex parser (fallback if Gemini unavailable) ───────────────────────

def parse_receipt_basic(text: str) -> dict:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = lines[0] if lines else "Unknown Store"

    amount_matches = re.findall(r"\d+[\.,]\d{2}", text)
    amounts = []
    for m in amount_matches:
        try:
            amounts.append(float(m.replace(",", ".")))
        except Exception:
            pass
    amount = str(max(amounts)) if amounts else "0"

    lower = text.lower()
    if any(w in lower for w in ["restaurant", "food", "cafe", "pizza", "burger", "swiggy", "zomato", "hotel"]):
        category = "Food"
    elif any(w in lower for w in ["uber", "ola", "bus", "metro", "taxi", "fuel", "petrol"]):
        category = "Travel"
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

    return {"title": title, "amount": amount, "category": category, "merchant": title, "date": None}


# ── Gemini Vision parser ───────────────────────────────────────────────────────

def parse_receipt_gemini(contents: bytes, filename: str, raw_text: str) -> dict:
    if not gemini_client:
        return parse_receipt_basic(raw_text)

    fname = filename.lower()
    if fname.endswith(".png"):
        mime_type = "image/png"
    elif fname.endswith(".pdf"):
        mime_type = "application/pdf"
    else:
        mime_type = "image/jpeg"

    prompt = f"""
You are a receipt parser. Extract information from this receipt image and return ONLY a JSON object.

Extract these fields:
- title: Short expense title (e.g. "Dinner at Pizza Hut", "Grocery Shopping")
- merchant: Store/restaurant name
- amount: Total amount paid as a number (e.g. 450.00) — find the final total, not subtotal
- category: One of: Food, Travel, Shopping, Bills, Health, Entertainment, Education, Fuel, Hotel, Other
- date: Date of purchase in YYYY-MM-DD format, or null if not found
- payment_method: Payment method if visible (UPI, Cash, Card, etc.), default "UPI"
- note: Any useful notes (e.g. "GST included", "Tip: 50")

Additional OCR text for reference:
{raw_text[:500] if raw_text else "No OCR text available"}

Respond ONLY with valid JSON, no markdown, no explanation:
{{"title": "", "merchant": "", "amount": 0.0, "category": "", "date": null, "payment_method": "UPI", "note": ""}}
"""

    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=contents, mime_type=mime_type),
                types.Part.from_text(text=prompt),
            ],
        )
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        print(f"Gemini Vision error: {e}")
        return parse_receipt_basic(raw_text)


# ── POST /ocr/ — Scan receipt ──────────────────────────────────────────────────

@router.post("/")
async def scan_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    contents = await file.read()

    # Save image
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    # Step 1: OCR.space for raw text
    raw_text = ocr_space_extract(contents, file.filename)

    # Step 2: Gemini Vision for smart parsing
    extracted = parse_receipt_gemini(contents, file.filename, raw_text)

    # Parse date
    receipt_date = None
    if extracted.get("date"):
        try:
            receipt_date = datetime.strptime(extracted["date"], "%Y-%m-%d")
        except Exception:
            pass

    # Save receipt to DB
    receipt = Receipt(
        user_id=user_id,
        image_url=f"/uploads/{filename}",
        raw_text=raw_text or "",
        title=extracted.get("title", "Unknown Store"),
        merchant=extracted.get("merchant", ""),
        amount=str(extracted.get("amount", "0")),
        category=extracted.get("category", "Other"),
        date=receipt_date,
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    return {
        "id": receipt.id,
        "title": receipt.title,
        "merchant": receipt.merchant,
        "amount": receipt.amount,
        "category": receipt.category,
        "date": extracted.get("date"),
        "payment_method": extracted.get("payment_method", "UPI"),
        "note": extracted.get("note", ""),
        "raw_text": raw_text,
        "image_url": receipt.image_url,
    }


# ── GET /ocr/history — Receipt history ────────────────────────────────────────

@router.get("/history")
def get_receipts(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    query = db.query(Receipt).order_by(Receipt.id.desc())
    if user_id:
        query = query.filter(Receipt.user_id == user_id)
    receipts = query.limit(50).all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "merchant": r.merchant,
            "amount": r.amount,
            "category": r.category,
            "date": r.date.strftime("%Y-%m-%d") if r.date else None,
            "image_url": r.image_url,
            "created_at": r.created_at,
        }
        for r in receipts
    ]


# ── DELETE /ocr/{receipt_id} — Delete receipt ─────────────────────────────────

@router.delete("/{receipt_id}")
def delete_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    query = db.query(Receipt).filter(Receipt.id == receipt_id)
    if user_id:
        query = query.filter(Receipt.user_id == user_id)
    receipt = query.first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    # Delete image file
    if receipt.image_url:
        filepath = receipt.image_url.lstrip("/")
        if os.path.exists(filepath):
            os.remove(filepath)

    db.delete(receipt)
    db.commit()
    return {"message": "Receipt deleted"}