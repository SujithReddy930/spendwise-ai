# backend/app/schemas/wallet_schema.py
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class WalletCreate(BaseModel):
    manager_member_id: Optional[int] = None


class DepositCreate(BaseModel):
    member_id: int
    amount: float = Field(..., gt=0)
    notes: Optional[str] = None
    deposit_date: Optional[datetime] = None


class DepositStatusUpdate(BaseModel):
    status: Literal["pending", "received"]