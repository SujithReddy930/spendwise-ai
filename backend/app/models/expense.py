from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from datetime import datetime
from app.database import Base

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    payment_method = Column(String, default="UPI")
    date = Column(DateTime, default=datetime.utcnow)
    note = Column(String, default="")
    is_recurring = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)