"""
Trip Expense Routes
Full CRUD + analytics for the Trip Expense Tracker module.
Mount in main.py with: app.include_router(trips_router, prefix="/trips", tags=["trips"])
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from app.database import get_db
from app.models.trip import Trip, TripExpense
from app.schemas.trip_schema import (
    TripCreate, TripUpdate, TripOut,
    TripExpenseCreate, TripExpenseUpdate, TripExpenseOut,
    TripAnalytics, CategoryBreakdown, DailySpend, AlertStatus,
)
from app.routes.auth import get_current_user

router = APIRouter()

# Category colors for analytics
CATEGORY_COLORS = {
    "Food":          "#10b981",
    "Travel":        "#3b82f6",
    "Hotel":         "#8b5cf6",
    "Shopping":      "#ec4899",
    "Fuel":          "#f59e0b",
    "Entertainment": "#ef4444",
    "Other":         "#6b7280",
}


# ── Helpers ─────────────────────────────────────────────────────────────────

def _get_trip_or_404(trip_id: int, user_id: int, db: Session) -> Trip:
    trip = db.query(Trip).filter(
        Trip.id == trip_id,
        Trip.user_id == user_id
    ).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


def _calc_total_spent(trip: Trip) -> float:
    return sum(e.amount for e in trip.expenses)


def _build_alert(pct: float) -> AlertStatus:
    if pct >= 100:
        return AlertStatus(
            level="exceeded",
            message=f"⚠️ Budget exceeded! You've spent {pct:.1f}% of your trip budget.",
            percentage=pct,
        )
    elif pct >= 90:
        return AlertStatus(
            level="90",
            message=f"🔴 90% of your budget is used ({pct:.1f}%). Spend carefully!",
            percentage=pct,
        )
    elif pct >= 80:
        return AlertStatus(
            level="80",
            message=f"🟡 80% of your budget is used ({pct:.1f}%). You're getting close.",
            percentage=pct,
        )
    return AlertStatus(level=None, message="Budget is on track.", percentage=pct)


def _check_and_update_alerts(trip: Trip, pct: float, db: Session):
    """Persist alert state so frontend can poll and show toasts."""
    changed = False
    if pct >= 80 and not trip.alert_80_sent:
        trip.alert_80_sent = True
        changed = True
    if pct >= 90 and not trip.alert_90_sent:
        trip.alert_90_sent = True
        changed = True
    if pct >= 100 and not trip.alert_exceeded_sent:
        trip.alert_exceeded_sent = True
        changed = True
    if changed:
        db.commit()


# ── Trip CRUD ────────────────────────────────────────────────────────────────

@router.post("/", response_model=TripOut, status_code=201)
def create_trip(
    data: TripCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = Trip(user_id=current_user.id, **data.dict())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("/", response_model=List[TripOut])
def list_trips(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Trip).filter(Trip.user_id == current_user.id)
    if status:
        q = q.filter(Trip.status == status)
    if search:
        q = q.filter(Trip.name.ilike(f"%{search}%") | Trip.destination.ilike(f"%{search}%"))
    return q.order_by(Trip.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{trip_id}", response_model=TripOut)
def get_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return _get_trip_or_404(trip_id, current_user.id, db)


@router.put("/{trip_id}", response_model=TripOut)
def update_trip(
    trip_id: int,
    data: TripUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = _get_trip_or_404(trip_id, current_user.id, db)
    for k, v in data.dict(exclude_unset=True).items():
        setattr(trip, k, v)
    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=204)
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = _get_trip_or_404(trip_id, current_user.id, db)
    db.delete(trip)
    db.commit()


# ── Trip Expense CRUD ────────────────────────────────────────────────────────

@router.post("/{trip_id}/expenses", response_model=TripExpenseOut, status_code=201)
def add_expense(
    trip_id: int,
    data: TripExpenseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = _get_trip_or_404(trip_id, current_user.id, db)
    expense = TripExpense(trip_id=trip.id, user_id=current_user.id, **data.dict())
    db.add(expense)
    db.commit()
    db.refresh(expense)

    # Recalculate and persist alert state
    total = _calc_total_spent(trip) + expense.amount
    pct = (total / trip.budget_limit * 100) if trip.budget_limit else 0
    _check_and_update_alerts(trip, pct, db)

    return expense


@router.get("/{trip_id}/expenses", response_model=List[TripExpenseOut])
def list_expenses(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _get_trip_or_404(trip_id, current_user.id, db)
    return db.query(TripExpense).filter(
        TripExpense.trip_id == trip_id,
        TripExpense.user_id == current_user.id,
    ).order_by(TripExpense.date.desc()).all()


@router.put("/{trip_id}/expenses/{expense_id}", response_model=TripExpenseOut)
def update_expense(
    trip_id: int,
    expense_id: int,
    data: TripExpenseUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _get_trip_or_404(trip_id, current_user.id, db)
    exp = db.query(TripExpense).filter(
        TripExpense.id == expense_id,
        TripExpense.trip_id == trip_id,
        TripExpense.user_id == current_user.id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    for k, v in data.dict(exclude_unset=True).items():
        setattr(exp, k, v)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/{trip_id}/expenses/{expense_id}", status_code=204)
def delete_expense(
    trip_id: int,
    expense_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _get_trip_or_404(trip_id, current_user.id, db)
    exp = db.query(TripExpense).filter(
        TripExpense.id == expense_id,
        TripExpense.trip_id == trip_id,
        TripExpense.user_id == current_user.id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(exp)
    db.commit()


# ── Analytics ────────────────────────────────────────────────────────────────

@router.get("/{trip_id}/analytics", response_model=TripAnalytics)
def get_trip_analytics(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = _get_trip_or_404(trip_id, current_user.id, db)
    expenses = trip.expenses

    total_spent = sum(e.amount for e in expenses)
    remaining = trip.budget_limit - total_spent
    pct = (total_spent / trip.budget_limit * 100) if trip.budget_limit else 0

    # Alert check
    _check_and_update_alerts(trip, pct, db)
    alert = _build_alert(pct)

    # Days
    now = datetime.utcnow()
    days_total = max((trip.end_date - trip.start_date).days, 1)
    days_elapsed = max(min((now - trip.start_date).days + 1, days_total), 1)
    daily_avg = total_spent / days_elapsed if days_elapsed > 0 else 0
    projected = daily_avg * days_total

    # Category breakdown
    cat_totals: dict[str, float] = defaultdict(float)
    cat_counts: dict[str, int] = defaultdict(int)
    for e in expenses:
        cat_totals[e.category] += e.amount
        cat_counts[e.category] += 1

    category_breakdown = [
        CategoryBreakdown(
            category=cat,
            total=total,
            count=cat_counts[cat],
            percentage=round(total / total_spent * 100, 1) if total_spent > 0 else 0,
            color=CATEGORY_COLORS.get(cat, "#6b7280"),
        )
        for cat, total in sorted(cat_totals.items(), key=lambda x: -x[1])
    ]

    # Daily timeline
    daily: dict[str, float] = defaultdict(float)
    for e in expenses:
        day_str = e.date.strftime("%Y-%m-%d") if e.date else now.strftime("%Y-%m-%d")
        daily[day_str] += e.amount
    daily_timeline = [
        DailySpend(date=d, total=t)
        for d, t in sorted(daily.items())
    ]

    return TripAnalytics(
        trip_id=trip.id,
        trip_name=trip.name,
        destination=trip.destination,
        budget_limit=trip.budget_limit,
        total_spent=round(total_spent, 2),
        remaining=round(remaining, 2),
        percentage_used=round(pct, 1),
        days_total=days_total,
        days_elapsed=days_elapsed,
        daily_average=round(daily_avg, 2),
        projected_total=round(projected, 2),
        status=trip.status,
        alert=alert,
        category_breakdown=category_breakdown,
        daily_timeline=daily_timeline,
        expense_count=len(expenses),
    )


# ── Summary (all trips) ──────────────────────────────────────────────────────

@router.get("/summary/all")
def get_all_trips_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns a lightweight summary of all trips for the trips list page."""
    trips = db.query(Trip).filter(Trip.user_id == current_user.id).order_by(Trip.created_at.desc()).all()
    result = []
    for trip in trips:
        total_spent = sum(e.amount for e in trip.expenses)
        pct = (total_spent / trip.budget_limit * 100) if trip.budget_limit else 0
        result.append({
            "id": trip.id,
            "name": trip.name,
            "destination": trip.destination,
            "budget_limit": trip.budget_limit,
            "total_spent": round(total_spent, 2),
            "remaining": round(trip.budget_limit - total_spent, 2),
            "percentage_used": round(pct, 1),
            "status": trip.status,
            "start_date": trip.start_date.isoformat(),
            "end_date": trip.end_date.isoformat(),
            "expense_count": len(trip.expenses),
            "alert_level": "exceeded" if pct >= 100 else "90" if pct >= 90 else "80" if pct >= 80 else None,
            "created_at": trip.created_at.isoformat() if trip.created_at else None,
        })
    return result