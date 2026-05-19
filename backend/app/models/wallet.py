# backend/app/models/wallet.py
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class TripWallet(Base):
    __tablename__ = "trip_wallets"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), unique=True, nullable=False)
    manager_member_id = Column(Integer, ForeignKey("trip_members.id", ondelete="SET NULL"), nullable=True)
    balance = Column(Float, default=0.0)
    total_deposits = Column(Float, default=0.0)
    total_expenses = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    trip = relationship("Trip", back_populates="wallet")                                                      # ← NEW
    deposits = relationship("WalletDeposit", back_populates="wallet", cascade="all, delete-orphan")
    transactions = relationship("WalletTransaction", back_populates="wallet", cascade="all, delete-orphan")
    manager = relationship("TripMember", foreign_keys=[manager_member_id])                                    # ← NEW


class WalletDeposit(Base):
    __tablename__ = "wallet_deposits"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("trip_wallets.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(Integer, ForeignKey("trip_members.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(20), default="pending")   # pending | received
    notes = Column(Text, nullable=True)
    deposit_date = Column(DateTime, default=datetime.utcnow)
    received_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    wallet = relationship("TripWallet", back_populates="deposits")
    member = relationship("TripMember", back_populates="deposits")                                            # ← NEW


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("trip_wallets.id", ondelete="CASCADE"), nullable=False)
    expense_id = Column(Integer, ForeignKey("trip_expenses.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Float, nullable=False)
    tx_type = Column(String(20), nullable=False)    # deposit | expense | settlement
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    wallet = relationship("TripWallet", back_populates="transactions")