from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


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
    
    # FIXED: Reverted to standard String type to safely match production VARCHAR schema
    status = Column(String, default="active", nullable=False)
    
    alert_80_sent = Column(Boolean, default=False)
    alert_90_sent = Column(Boolean, default=False)
    alert_exceeded_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    expenses = relationship("TripExpense", back_populates="trip", cascade="all, delete-orphan")
    members = relationship("TripMember", back_populates="trip", cascade="all, delete-orphan")
    wallet = relationship("TripWallet", back_populates="trip", uselist=False, cascade="all, delete-orphan")

class TripExpense(Base):
    __tablename__ = "trip_expenses"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(50), nullable=False, default="Other")
    notes = Column(Text, nullable=True)
    date = Column(DateTime, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    trip = relationship("Trip", back_populates="expenses")
    splits = relationship("ExpenseSplit", back_populates="expense", cascade="all, delete-orphan")


class TripMember(Base):
    __tablename__ = "trip_members"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    trip = relationship("Trip", back_populates="members")
    splits = relationship("ExpenseSplit", back_populates="member", cascade="all, delete-orphan")
    deposits = relationship("WalletDeposit", back_populates="member", cascade="all, delete-orphan")


class ExpenseSplit(Base):
    __tablename__ = "expense_splits"

    id = Column(Integer, primary_key=True, index=True)
    trip_expense_id = Column(Integer, ForeignKey("trip_expenses.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("trip_members.id"), nullable=False)
    amount = Column(Float, nullable=False)
    paid = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    member = relationship("TripMember", back_populates="splits")
    expense = relationship("TripExpense", back_populates="splits")


class TripExpenseHistory(Base):
    __tablename__ = "trip_expense_history"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False, index=True)
    expense_id = Column(Integer, nullable=True)
    action = Column(String(20), nullable=False)  # "added", "updated", "deleted"
    title = Column(String(200), nullable=True)
    old_amount = Column(Float, nullable=True)
    new_amount = Column(Float, nullable=True)
    old_category = Column(String(100), nullable=True)
    new_category = Column(String(100), nullable=True)
    old_notes = Column(Text, nullable=True)
    new_notes = Column(Text, nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    trip = relationship("Trip", backref="expense_history")
