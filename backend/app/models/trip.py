"""
Trip Expense Models
Defines Trip and TripExpense tables for PostgreSQL via SQLAlchemy.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class TripStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TripCategory(str, enum.Enum):
    FOOD = "Food"
    TRAVEL = "Travel"
    HOTEL = "Hotel"
    SHOPPING = "Shopping"
    FUEL = "Fuel"
    ENTERTAINMENT = "Entertainment"
    OTHER = "Other"


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    destination = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)

    budget_limit = Column(Float, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    status = Column(String(20), default=TripStatus.ACTIVE)

    # Alert tracking — prevent repeated alerts
    alert_80_sent = Column(Boolean, default=False)
    alert_90_sent = Column(Boolean, default=False)
    alert_exceeded_sent = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    expenses = relationship("TripExpense", back_populates="trip", cascade="all, delete-orphan")


class TripExpense(Base):
    __tablename__ = "trip_expenses"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(50), nullable=False, default=TripCategory.OTHER)
    notes = Column(Text, nullable=True)
    date = Column(DateTime, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    trip = relationship("Trip", back_populates="expenses")