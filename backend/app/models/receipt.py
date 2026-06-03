from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Image storage
    image_url = Column(String, nullable=True)

    # OCR raw output
    raw_text = Column(Text, nullable=True)

    # Parsed fields
    title = Column(String, nullable=True)
    merchant = Column(String, nullable=True)
    amount = Column(String, nullable=True)          # kept as String to match existing schema
    category = Column(String, nullable=True)
    date = Column(DateTime, nullable=True)          # date on the receipt

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    user = relationship("User", backref="receipts")