"""
Trip Expense Routes
Uses same auth pattern as expenses.py: decode_token from Authorization header.
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from collections import defaultdict

from app.database import SessionLocal
from app.models.trip import Trip, TripExpense
from app.schemas.trip_schema import (
    TripCreate, TripUpdate,
    TripExpenseCreate, TripExpenseUpdate,
    TripAnalytics, CategoryBreakdown, DailySpend, AlertStatus,
)
from app.core.security import decode_token

router = APIRouter(prefix="/trips", tags=["trips"])

CATEGORY_COLORS = {
    "Food":          "#10b981",
    "Travel":        "#3b82f6",
    "Hotel":         "#8b5cf6",
    "Shopping":      "#ec4899",
    "Fuel":          "#f59e0b",
    "Entertainment": "#ef4444",
    "Other":         "#6b7280",
}


# ── DB + Auth ────────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user_id(authorization: str = Header(...)) -> int:
    """Extract user_id from Bearer token — matches decode_token in security.py"""
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return int(payload.get("sub"))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_trip_or_404(trip_id: int, user_id: int, db: Session) -> Trip:
    trip = db.query(Trip).filter(
        Trip.id == trip_id,
        Trip.user_id == user_id
    ).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


def calc_total_spent(trip: Trip) -> float:
    return sum(e.amount for e in trip.expenses)


def build_alert(pct: float) -> AlertStatus:
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


def check_and_update_alerts(trip: Trip, pct: float, db: Session):
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

@router.post("/", status_code=201)
def create_trip(
    data: TripCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    trip = Trip(user_id=user_id, **data.dict())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return {
        "id": trip.id,
        "name": trip.name,
        "destination": trip.destination,
        "description": trip.description,
        "budget_limit": trip.budget_limit,
        "start_date": trip.start_date.isoformat(),
        "end_date": trip.end_date.isoformat(),
        "status": trip.status,
        "created_at": trip.created_at.isoformat() if trip.created_at else None,
        "expenses": [],
    }


@router.get("/summary/all")
def get_all_trips_summary(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Lightweight summary of all trips for the list page."""
    trips = db.query(Trip).filter(
        Trip.user_id == user_id
    ).order_by(Trip.created_at.desc()).all()

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
            "alert_level": (
                "exceeded" if pct >= 100
                else "90" if pct >= 90
                else "80" if pct >= 80
                else None
            ),
            "created_at": trip.created_at.isoformat() if trip.created_at else None,
        })
    return result


@router.get("/{trip_id}")
def get_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    trip = get_trip_or_404(trip_id, user_id, db)
    return {
        "id": trip.id,
        "name": trip.name,
        "destination": trip.destination,
        "description": trip.description,
        "budget_limit": trip.budget_limit,
        "start_date": trip.start_date.isoformat(),
        "end_date": trip.end_date.isoformat(),
        "status": trip.status,
        "alert_80_sent": trip.alert_80_sent,
        "alert_90_sent": trip.alert_90_sent,
        "alert_exceeded_sent": trip.alert_exceeded_sent,
        "created_at": trip.created_at.isoformat() if trip.created_at else None,
        "expenses": [
            {
                "id": e.id,
                "trip_id": e.trip_id,
                "title": e.title,
                "amount": e.amount,
                "category": e.category,
                "notes": e.notes,
                "date": e.date.isoformat() if e.date else None,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in sorted(trip.expenses, key=lambda x: x.date or datetime.min, reverse=True)
        ],
    }


@router.put("/{trip_id}")
def update_trip(
    trip_id: int,
    data: TripUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    trip = get_trip_or_404(trip_id, user_id, db)
    for k, v in data.dict(exclude_unset=True).items():
        setattr(trip, k, v)
    db.commit()
    db.refresh(trip)
    return {"message": "Trip updated", "id": trip.id}


@router.delete("/{trip_id}", status_code=204)
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    trip = get_trip_or_404(trip_id, user_id, db)
    db.delete(trip)
    db.commit()


# ── Trip Expense CRUD ────────────────────────────────────────────────────────

@router.post("/{trip_id}/expenses", status_code=201)
def add_expense(
    trip_id: int,
    data: TripExpenseCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    trip = get_trip_or_404(trip_id, user_id, db)
    expense = TripExpense(trip_id=trip.id, user_id=user_id, **data.dict())
    db.add(expense)
    db.commit()
    db.refresh(expense)

    # Recalculate and persist alert thresholds
    total = calc_total_spent(trip)
    pct = (total / trip.budget_limit * 100) if trip.budget_limit else 0
    check_and_update_alerts(trip, pct, db)

    return {
        "id": expense.id,
        "trip_id": expense.trip_id,
        "title": expense.title,
        "amount": expense.amount,
        "category": expense.category,
        "notes": expense.notes,
        "date": expense.date.isoformat() if expense.date else None,
        "created_at": expense.created_at.isoformat() if expense.created_at else None,
    }


@router.get("/{trip_id}/expenses")
def list_expenses(
    trip_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    expenses = db.query(TripExpense).filter(
        TripExpense.trip_id == trip_id,
        TripExpense.user_id == user_id,
    ).order_by(TripExpense.date.desc()).all()

    return [
        {
            "id": e.id,
            "trip_id": e.trip_id,
            "title": e.title,
            "amount": e.amount,
            "category": e.category,
            "notes": e.notes,
            "date": e.date.isoformat() if e.date else None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in expenses
    ]


@router.put("/{trip_id}/expenses/{expense_id}")
def update_expense(
    trip_id: int,
    expense_id: int,
    data: TripExpenseUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    exp = db.query(TripExpense).filter(
        TripExpense.id == expense_id,
        TripExpense.trip_id == trip_id,
        TripExpense.user_id == user_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    for k, v in data.dict(exclude_unset=True).items():
        setattr(exp, k, v)
    db.commit()
    db.refresh(exp)
    return {
        "id": exp.id,
        "trip_id": exp.trip_id,
        "title": exp.title,
        "amount": exp.amount,
        "category": exp.category,
        "notes": exp.notes,
        "date": exp.date.isoformat() if exp.date else None,
        "created_at": exp.created_at.isoformat() if exp.created_at else None,
    }


@router.delete("/{trip_id}/expenses/{expense_id}", status_code=204)
def delete_expense(
    trip_id: int,
    expense_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    exp = db.query(TripExpense).filter(
        TripExpense.id == expense_id,
        TripExpense.trip_id == trip_id,
        TripExpense.user_id == user_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(exp)
    db.commit()


# ── Analytics ────────────────────────────────────────────────────────────────

@router.get("/{trip_id}/analytics")
def get_trip_analytics(
    trip_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    trip = get_trip_or_404(trip_id, user_id, db)
    expenses = trip.expenses

    total_spent = sum(e.amount for e in expenses)
    remaining = trip.budget_limit - total_spent
    pct = (total_spent / trip.budget_limit * 100) if trip.budget_limit else 0

    check_and_update_alerts(trip, pct, db)
    alert = build_alert(pct)

    # Days calculation
    now = datetime.utcnow()
    days_total = max((trip.end_date - trip.start_date).days, 1)
    days_elapsed = max(min((now - trip.start_date).days + 1, days_total), 1)
    daily_avg = total_spent / days_elapsed if days_elapsed > 0 else 0
    projected = daily_avg * days_total

    # Category breakdown
    cat_totals: dict = defaultdict(float)
    cat_counts: dict = defaultdict(int)
    for e in expenses:
        cat_totals[e.category] += e.amount
        cat_counts[e.category] += 1

    category_breakdown = [
        {
            "category": cat,
            "total": round(total, 2),
            "count": cat_counts[cat],
            "percentage": round(total / total_spent * 100, 1) if total_spent > 0 else 0,
            "color": CATEGORY_COLORS.get(cat, "#6b7280"),
        }
        for cat, total in sorted(cat_totals.items(), key=lambda x: -x[1])
    ]

    # Daily timeline
    daily: dict = defaultdict(float)
    for e in expenses:
        day_str = e.date.strftime("%Y-%m-%d") if e.date else now.strftime("%Y-%m-%d")
        daily[day_str] += e.amount

    daily_timeline = [
        {"date": d, "total": round(t, 2)}
        for d, t in sorted(daily.items())
    ]

    return {
        "trip_id": trip.id,
        "trip_name": trip.name,
        "destination": trip.destination,
        "budget_limit": trip.budget_limit,
        "total_spent": round(total_spent, 2),
        "remaining": round(remaining, 2),
        "percentage_used": round(pct, 1),
        "days_total": days_total,
        "days_elapsed": days_elapsed,
        "daily_average": round(daily_avg, 2),
        "projected_total": round(projected, 2),
        "status": trip.status,
        "alert": {
            "level": alert.level,
            "message": alert.message,
            "percentage": alert.percentage,
        },
        "category_breakdown": category_breakdown,
        "daily_timeline": daily_timeline,
        "expense_count": len(expenses),
    }