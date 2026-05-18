from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

from app.database import SessionLocal, engine
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate
from app.core.security import decode_token
from sqlalchemy import text

router = APIRouter(prefix="/expenses", tags=["Expenses"])

SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# ── Migrations ───────────────────────────────────────
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR DEFAULT 'UPI'"))
        conn.execute(text("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS note VARCHAR DEFAULT ''"))
        conn.execute(text("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE expenses ALTER COLUMN user_id DROP NOT NULL"))
        conn.commit()
except Exception as e:
    print(f"Migration note: {e}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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


# ── CRUD ─────────────────────────────────────────────

@router.post("/")
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    user_id = get_current_user_id(authorization)
    expense_date = datetime.utcnow()
    if data.date:
        try:
            expense_date = datetime.strptime(data.date, "%Y-%m-%d")
        except Exception:
            expense_date = datetime.utcnow()

    expense = Expense(
        title=data.title,
        amount=data.amount,
        category=data.category,
        payment_method=data.payment_method,
        date=expense_date,
        note=data.note,
        is_recurring=data.is_recurring,
        user_id=user_id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/")
def get_expenses(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    user_id = get_current_user_id(authorization)
    if user_id:
        return db.query(Expense).filter(Expense.user_id == user_id).order_by(Expense.id.desc()).all()
    return []


@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    user_id = get_current_user_id(authorization)
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == user_id
    ).first()
    if not expense:
        return {"message": "Expense not found"}
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted"}


# ── Summary ───────────────────────────────────────────

@router.get("/summary")
def get_summary(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
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
    return {"total": round(total, 2), "by_category": by_category, "count": len(month_expenses)}


# ── Helpers ───────────────────────────────────────────

def _filter_by_month(expenses, month: int, year: int):
    """Filter expenses to a specific month/year. Falls back to all if no date."""
    result = []
    for e in expenses:
        d = getattr(e, "date", None)
        if d and isinstance(d, datetime):
            if d.month == month and d.year == year:
                result.append(e)
        else:
            result.append(e)
    return result


def _generate_insights(expenses: list) -> list:
    if not expenses:
        return ["No expenses recorded yet. Start adding expenses to get personalised AI insights! 🚀"]

    now = datetime.today()
    days_elapsed = max(now.day, 1)
    days_in_month = 30
    total = sum(e.amount for e in expenses)
    daily_avg = total / days_elapsed
    projected = daily_avg * days_in_month
    days_remaining = days_in_month - days_elapsed

    by_cat = {}
    for e in expenses:
        by_cat[e.category] = by_cat.get(e.category, 0) + e.amount

    top_cat = max(by_cat, key=by_cat.get) if by_cat else None
    top_amt = by_cat.get(top_cat, 0)
    top_pct = round((top_amt / total) * 100) if total > 0 else 0

    tips = {
        "Food": "🍱 Try meal prepping a few days a week to cut food costs significantly.",
        "Transport": "🚌 Consider public transport or carpooling to reduce travel expenses.",
        "Shopping": "🛍️ Wait 24 hours before non-essential purchases to avoid impulse buying.",
        "Entertainment": "🎬 Look for free events and share streaming plans to save on entertainment.",
        "Bills": "💡 Review subscriptions monthly and cancel ones you rarely use.",
        "Health": "💊 Ask your doctor about generic medicines to reduce healthcare costs.",
        "Education": "📚 Supplement paid courses with free resources on YouTube or Coursera.",
        "Other": "💰 Track miscellaneous expenses closely — small costs add up fast.",
    }

    insights = []

    if top_cat:
        insights.append(
            f"🏆 Your biggest spend is {top_cat} at ₹{top_amt:,.0f} ({top_pct}% of total). "
            f"Consider reviewing this category."
        )

    insights.append(
        f"📊 You're averaging ₹{daily_avg:,.0f}/day. "
        f"At this pace you'll spend ₹{projected:,.0f} by month end."
    )

    if top_cat and top_cat in tips:
        insights.append(tips[top_cat])

    recurring = [e for e in expenses if getattr(e, "is_recurring", False)]
    if recurring:
        rec_total = sum(e.amount for e in recurring)
        insights.append(
            f"🔄 You have {len(recurring)} recurring expense(s) totalling ₹{rec_total:,.0f}. "
            "Review them to ensure they're still needed."
        )
    elif days_remaining <= 7:
        insights.append(
            f"📅 Only {days_remaining} days left this month — "
            f"try to keep daily spend under ₹{daily_avg:,.0f} to stay on track."
        )

    return insights[:4]


# ── AI Insights (local — no external ML service) ──────

@router.get("/insights")
def get_insights(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    user_id = get_current_user_id(authorization)
    query = db.query(Expense)
    if user_id:
        query = query.filter(Expense.user_id == user_id)
    all_expenses = query.all()
    month_expenses = _filter_by_month(all_expenses, month, year)
    return {"insights": _generate_insights(month_expenses)}


# ── AI Prediction (local linear projection) ───────────

@router.get("/prediction")
def get_prediction(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    user_id = get_current_user_id(authorization)
    query = db.query(Expense)
    if user_id:
        query = query.filter(Expense.user_id == user_id)
    all_expenses = query.all()
    month_expenses = _filter_by_month(all_expenses, month, year)

    current_spent = sum(e.amount for e in month_expenses)
    now = datetime.today()
    days_elapsed = max(now.day, 1)
    days_in_month = 30

    daily_avg = current_spent / days_elapsed
    predicted_total = round(daily_avg * days_in_month, 2)

    if days_elapsed >= 15:
        confidence = "high"
    elif days_elapsed >= 7:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "predicted_total": predicted_total,
        "current_spent": round(current_spent, 2),
        "daily_average": round(daily_avg, 2),
        "days_elapsed": days_elapsed,
        "days_remaining": days_in_month - days_elapsed,
        "confidence": confidence,
    }


# ── Email Report ──────────────────────────────────────

class EmailReportRequest(BaseModel):
    email: EmailStr


@router.post("/send-report")
def send_report(
    req: EmailReportRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        raise HTTPException(
            status_code=503,
            detail="Email not configured. Set SMTP_EMAIL and SMTP_PASSWORD in Render environment."
        )

    user_id = get_current_user_id(authorization)
    query = db.query(Expense).order_by(Expense.id.desc())
    if user_id:
        query = query.filter(Expense.user_id == user_id)
    expenses = query.all()

    total = sum(e.amount for e in expenses)
    by_category = {}
    for e in expenses:
        by_category[e.category] = by_category.get(e.category, 0) + e.amount

    now = datetime.now()
    month_name = now.strftime("%B %Y")

    rows = "".join(
        f"<tr>"
        f"<td style='padding:8px;border-bottom:1px solid #eee'>{e.title}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee'>{e.category}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>₹{e.amount:,.0f}</td>"
        f"</tr>"
        for e in expenses[:20]
    )
    cat_rows = "".join(
        f"<tr>"
        f"<td style='padding:6px'>{cat}</td>"
        f"<td style='padding:6px;text-align:right'>₹{amt:,.0f}</td>"
        f"</tr>"
        for cat, amt in sorted(by_category.items(), key=lambda x: -x[1])
    )

    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#10b981;color:white;padding:24px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:22px">💰 SpendWise Report</h1>
        <p style="margin:4px 0 0;opacity:0.85">{month_name}</p>
      </div>
      <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 4px;font-size:28px;color:#111">₹{total:,.0f}</h2>
        <p style="color:#6b7280;margin:0 0 20px">Total spent · {len(expenses)} transactions</p>
        <h3 style="font-size:14px;color:#374151;margin-bottom:8px">By Category</h3>
        <table width="100%" style="border-collapse:collapse;margin-bottom:20px;background:white;border-radius:8px">
          {cat_rows}
        </table>
        <h3 style="font-size:14px;color:#374151;margin-bottom:8px">Recent Transactions</h3>
        <table width="100%" style="border-collapse:collapse;background:white;border-radius:8px">
          <tr style="background:#10b981;color:white">
            <th style="padding:8px;text-align:left">Title</th>
            <th style="padding:8px;text-align:left">Category</th>
            <th style="padding:8px;text-align:right">Amount</th>
          </tr>
          {rows}
        </table>
        <p style="color:#9ca3af;font-size:12px;margin-top:20px;text-align:center">
          Sent by SpendWise AI · Your personal finance tracker
        </p>
      </div>
    </div>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"SpendWise Report — {month_name}"
        msg["From"] = SMTP_EMAIL
        msg["To"] = req.email
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(SMTP_EMAIL, SMTP_PASSWORD)
            smtp.sendmail(SMTP_EMAIL, req.email, msg.as_string())
        return {"message": f"Report sent to {req.email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")