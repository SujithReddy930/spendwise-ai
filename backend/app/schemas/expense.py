from pydantic import BaseModel
from typing import Optional
from datetime import date

class ExpenseCreate(BaseModel):
    title: str
    amount: float
    category: str
    payment_method: Optional[str] = "UPI"
    date: Optional[date] = None
    note: Optional[str] = ""
    is_recurring: Optional[bool] = False

class ExpenseResponse(BaseModel):
    id: int
    title: str
    amount: float
    category: str

    class Config:
        from_attributes = True