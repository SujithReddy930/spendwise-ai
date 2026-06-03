from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class AIInsight(Base):
    """Stores Gemini-generated spending insights per user per month."""
    __tablename__ = "ai_insights"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    month = Column(Integer, nullable=False)         # 1-12
    year = Column(Integer, nullable=False)

    # Gemini response stored as JSON list of insight strings
    insights = Column(JSON, nullable=False, default=list)

    # Summary stats snapshot used to generate insights
    total_spent = Column(Float, nullable=True)
    top_category = Column(String(100), nullable=True)
    expense_count = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="ai_insights")


class AIPrediction(Base):
    """Stores Gemini-generated spend predictions per user per month."""
    __tablename__ = "ai_predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)

    # Gemini prediction output
    predicted_total = Column(Float, nullable=True)
    confidence = Column(String(20), nullable=True)  # low / medium / high
    summary = Column(Text, nullable=True)           # narrative from Gemini
    breakdown = Column(JSON, nullable=True)         # per-category predictions

    # Raw inputs snapshot
    days_elapsed = Column(Integer, nullable=True)
    days_in_month = Column(Integer, nullable=True)
    total_spent_so_far = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="ai_predictions")


class BudgetLimit(Base):
    """Per-user, per-category monthly budget limits."""
    __tablename__ = "budget_limits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(100), nullable=False)
    monthly_limit = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="budget_limits")