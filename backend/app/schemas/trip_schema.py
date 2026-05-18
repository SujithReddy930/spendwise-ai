"""
Trip Pydantic Schemas
Request/response validation for trip expense module.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime


# ── Trip Expense Schemas ────────────────────────────────────────────────────

class TripExpenseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(..., gt=0)
    category: str = Field(default="Other")
    notes: Optional[str] = None
    date: datetime

    @validator("category")
    def validate_category(cls, v):
        valid = ["Food", "Travel", "Hotel", "Shopping", "Fuel", "Entertainment", "Other"]
        if v not in valid:
            raise ValueError(f"Category must be one of {valid}")
        return v


class TripExpenseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    amount: Optional[float] = Field(None, gt=0)
    category: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[datetime] = None


class TripExpenseOut(BaseModel):
    id: int
    trip_id: int
    title: str
    amount: float
    category: str
    notes: Optional[str]
    date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ── Trip Schemas ────────────────────────────────────────────────────────────

class TripCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    destination: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = None
    budget_limit: float = Field(..., gt=0)
    start_date: datetime
    end_date: datetime

    @validator("end_date")
    def end_after_start(cls, v, values):
        if "start_date" in values and v < values["start_date"]:
            raise ValueError("end_date must be after start_date")
        return v


class TripUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    destination: Optional[str] = None
    description: Optional[str] = None
    budget_limit: Optional[float] = Field(None, gt=0)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None


class TripOut(BaseModel):
    id: int
    name: str
    destination: str
    description: Optional[str]
    budget_limit: float
    start_date: datetime
    end_date: datetime
    status: str
    alert_80_sent: bool
    alert_90_sent: bool
    alert_exceeded_sent: bool
    created_at: datetime
    expenses: List[TripExpenseOut] = []

    class Config:
        from_attributes = True


# ── Analytics Schemas ───────────────────────────────────────────────────────

class CategoryBreakdown(BaseModel):
    category: str
    total: float
    count: int
    percentage: float
    color: str


class DailySpend(BaseModel):
    date: str
    total: float


class AlertStatus(BaseModel):
    level: Optional[str]   # "80", "90", "exceeded", or None
    message: str
    percentage: float


class TripAnalytics(BaseModel):
    trip_id: int
    trip_name: str
    destination: str
    budget_limit: float
    total_spent: float
    remaining: float
    percentage_used: float
    days_total: int
    days_elapsed: int
    daily_average: float
    projected_total: float
    status: str
    alert: AlertStatus
    category_breakdown: List[CategoryBreakdown]
    daily_timeline: List[DailySpend]
    expense_count: int