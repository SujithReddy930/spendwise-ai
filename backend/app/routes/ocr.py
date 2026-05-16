from fastapi import APIRouter
from fastapi import UploadFile
from fastapi import File
from fastapi import Depends

from sqlalchemy.orm import Session

from app.database import SessionLocal

from app.models.receipt import Receipt

from PIL import Image
from pdf2image import convert_from_bytes

import pytesseract
import io
import re
import os
import uuid

router = APIRouter(
    prefix="/ocr",
    tags=["OCR"],
)

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

POPPLER_PATH = r"C:\poppler\poppler-26.02.0\Library\bin"

UPLOAD_FOLDER = "uploads"

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()

@router.post("/")
async def scan_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    contents = await file.read()

    filename = (
        f"{uuid.uuid4()}_{file.filename}"
    )

    filepath = os.path.join(
        UPLOAD_FOLDER,
        filename,
    )

    with open(filepath, "wb") as f:
        f.write(contents)

    text = ""

    if file.filename.endswith(".pdf"):
        pages = convert_from_bytes(
            contents,
            poppler_path=POPPLER_PATH,
        )

        for page in pages:
            text += pytesseract.image_to_string(
                page
            )

    else:
        image = Image.open(
            io.BytesIO(contents)
        )

        text = pytesseract.image_to_string(
            image
        )

    amount_match = re.findall(
        r"\d+\.\d{2}",
        text,
    )

    amount = (
        max(amount_match)
        if amount_match
        else "0"
    )

    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    title = (
        lines[0]
        if lines
        else "Unknown Store"
    )

    category = "Shopping"

    lower_text = text.lower()

    if (
        "restaurant" in lower_text
        or "food" in lower_text
    ):
        category = "Food"

    elif (
        "uber" in lower_text
        or "bus" in lower_text
    ):
        category = "Transport"

    receipt = Receipt(
        image_url=f"/uploads/{filename}",
        raw_text=text,
        title=title,
        amount=amount,
        category=category,
    )

    db.add(receipt)

    db.commit()

    db.refresh(receipt)

    return {
        "id": receipt.id,
        "title": title,
        "amount": amount,
        "category": category,
        "raw_text": text,
        "image_url": receipt.image_url,
    }

@router.get("/history")
def get_receipts(
    db: Session = Depends(get_db),
):
    receipts = db.query(
        Receipt
    ).all()

    return receipts