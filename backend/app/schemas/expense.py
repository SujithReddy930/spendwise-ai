from pydantic import BaseModel

class ExpenseCreate(BaseModel):
    title: str
    amount: float
    category: str

class ExpenseResponse(BaseModel):
    id: int
    title: str
    amount: float
    category: str

    class Config:
        from_attributes = True