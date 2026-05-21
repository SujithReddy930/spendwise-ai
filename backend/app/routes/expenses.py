from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from calendar import monthrange
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.database import SessionLocal
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate
from app.core.security import decode_token

router = APIRouter(prefix="/expenses", tags=["Expenses"])

SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")


# ── Database session ──────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Auth helper ───────────────────────────────────────────────────────────────

def get_current_user_id(authorization: Optional[str] = Header(None)) -> Optional[int]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        return None
    try:
        return int(payload.get("sub"))
    except Exception:
        return None


# ── Filter helper ─────────────────────────────────────────────────────────────

def _filter_by_month(expenses, month, year):
    result = []
    for e in expenses:
        d = getattr(e, "date", None)
        if d and isinstance(d, datetime):
            if d.month == month and d.year == year:
                result.append(e)
        else:
            result.append(e)
    return result


# ── Create expense ────────────────────────────────────────────────────────────

@router.post("/")
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    expense_date = datetime.utcnow()
    if getattr(data, "date", None):
        try:
            expense_date = datetime.strptime(data.date, "%Y-%m-%d")
        except Exception:
            pass

    expense = Expense(
        title=data.title,
        amount=data.amount,
        category=data.category,
        payment_method=data.payment_method,
        note=data.note,
        is_recurring=data.is_recurring,
        date=expense_date,
        user_id=user_id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


# ── Get expenses ──────────────────────────────────────────────────────────────

@router.get("/")
def get_expenses(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    if not user_id:
        return []
    return (
        db.query(Expense)
        .filter(Expense.user_id == user_id)
        .order_by(Expense.id.desc())
        .all()
    )


# ── Delete expense ────────────────────────────────────────────────────────────

@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.user_id == user_id)
        .first()
    )
    if not expense:
        return {"message": "Expense not found"}
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted"}


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get("/summary")
def get_summary(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    query = db.query(Expense)
    if user_id:
        query = query.filter(Expense.user_id == user_id)

    expenses = query.all()
    month_expenses = _filter_by_month(expenses, month, year)
    total = sum(e.amount for e in month_expenses)

    by_category = {}
    for e in month_expenses:
        by_category[e.category] = round(by_category.get(e.category, 0) + e.amount, 2)

    return {
        "total": round(total, 2),
        "by_category": by_category,
        "count": len(month_expenses),
    }


# ── Insights ──────────────────────────────────────────────────────────────────

@router.get("/insights")
def get_insights(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    query = db.query(Expense)
    if user_id:
        query = query.filter(Expense.user_id == user_id)

    all_expenses = query.all()
    month_expenses = _filter_by_month(all_expenses, month, year)
    total = sum(e.amount for e in month_expenses)

    if not month_expenses:
        return {"insights": ["Add expenses to see personalised AI insights."]}

    # Category breakdown
    by_cat = {}
    for e in month_expenses:
        by_cat[e.category] = by_cat.get(e.category, 0) + e.amount

    top_cat = max(by_cat, key=by_cat.get)
    top_pct = round(by_cat[top_cat] / total * 100)

    insights = [
        f"Your biggest spend this month is {top_cat} at {top_pct}% of total (₹{round(by_cat[top_cat]):,}).",
        f"You've logged {len(month_expenses)} transactions totalling ₹{round(total):,} so far.",
    ]

    if len(by_cat) > 1:
        lowest_cat, lowest_amt = min(by_cat.items(), key=lambda x: x[1])
        insights.append(f"Lowest spend category: {lowest_cat} at ₹{round(lowest_amt):,}.")

    return {"insights": insights}


# ── Prediction ────────────────────────────────────────────────────────────────

@router.get("/prediction")
def get_prediction(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    query = db.query(Expense)
    if user_id:
        query = query.filter(Expense.user_id == user_id)

    all_expenses = query.all()
    month_expenses = _filter_by_month(all_expenses, month, year)
    total_spent = sum(e.amount for e in month_expenses)

    # Date math
    today = datetime.utcnow()
    days_in_month = monthrange(year, month)[1]
    is_current_month = (month == today.month and year == today.year)
    days_elapsed = today.day if is_current_month else days_in_month
    days_remaining = days_in_month - days_elapsed

    # Linear forecast from daily average
    daily_avg = total_spent / days_elapsed if days_elapsed > 0 else 0
    linear_forecast = round(daily_avg * days_in_month)

    # Confidence based on how much of the month has passed
    data_pct = days_elapsed / days_in_month
    if data_pct >= 0.6:
        confidence = "high"
    elif data_pct >= 0.3:
        confidence = "medium"
    else:
        confidence = "low"

    # Blend with last month's total for a smarter estimate
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    prev_expenses = _filter_by_month(all_expenses, prev_month, prev_year)
    prev_total = sum(e.amount for e in prev_expenses)

    if prev_total > 0 and is_current_month:
        predicted_total = round(0.7 * linear_forecast + 0.3 * prev_total)
        if data_pct >= 0.5:
            confidence = "high"
    else:
        predicted_total = linear_forecast

    return {
        "predicted_total": predicted_total,
        "confidence": confidence,
        "total_spent": round(total_spent, 2),
        "daily_avg": round(daily_avg, 2),
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "days_in_month": days_in_month,
        "linear_forecast": linear_forecast,
        "prev_month_total": round(prev_total, 2),
    }


# ── Email report ──────────────────────────────────────────────────────────────

class EmailReportRequest(BaseModel):
    email: EmailStr


@router.post("/send-report")
def send_report(req: EmailReportRequest):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        raise HTTPException(status_code=503, detail="Email not configured.")
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "SpendWise Report"
        msg["From"] = SMTP_EMAIL
        msg["To"] = req.email
        msg.attach(MIMEText("<h1>SpendWise Report</h1>", "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(SMTP_EMAIL, SMTP_PASSWORD)
            smtp.sendmail(SMTP_EMAIL, req.email, msg.as_string())

        return {"message": f"Report sent to {req.email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))