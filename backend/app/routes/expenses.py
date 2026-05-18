from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

from app.database import SessionLocal, engine
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseCreate
from app.core.security import decode_token
from sqlalchemy import text

router = APIRouter(prefix="/expenses", tags=["Expenses"])
AI_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8001")

SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# ── Run migrations on startup ────────────────────────
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
    except:
        return None

# ── CRUD ────────────────────────────────────────────

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

# ── Summary ─────────────────────────────────────────

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
    all_expenses = query.all()
    total = sum(e.amount for e in all_expenses)
    by_category = {}
    for e in all_expenses:
        by_category[e.category] = round(by_category.get(e.category, 0) + e.amount, 2)
    return {"total": round(total, 2), "by_category": by_category, "count": len(all_expenses)}

# ── AI Insights ──────────────────────────────────────

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
    curr_total = sum(e.amount for e in all_expenses)
    curr_by_cat = {}
    for e in all_expenses:
        curr_by_cat[e.category] = curr_by_cat.get(e.category, 0) + e.amount

    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    prev_month = month - 1 if month > 1 else 12

    try:
        with httpx.Client(timeout=5.0) as client:
            res = client.post(f"{AI_SERVICE_URL}/ai/insights", json={
                "current_by_category": curr_by_cat,
                "previous_by_category": {},
                "current_total": curr_total,
                "previous_total": 0,
                "current_month": month_names[month - 1],
                "previous_month": month_names[prev_month - 1]
            })
            return res.json()
    except Exception:
        return {"insights": ["AI service unavailable."]}

# ── AI Prediction ────────────────────────────────────

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
    current_spent = sum(e.amount for e in all_expenses)
    days_elapsed = datetime.today().day

    try:
        with httpx.Client(timeout=5.0) as client:
            res = client.post(f"{AI_SERVICE_URL}/ai/predict", json={
                "monthly_totals": [current_spent * 0.9, current_spent * 0.85],
                "current_spent": current_spent,
                "days_elapsed": days_elapsed,
                "total_days": 30
            })
            return res.json()
    except Exception:
        return {"error": "AI service unavailable"}

# ── Email Report ─────────────────────────────────────

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
            detail="Email not configured. Set SMTP_EMAIL and SMTP_PASSWORD in your .env file."
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
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{e.title}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee'>{e.category}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>₹{e.amount:,.0f}</td></tr>"
        for e in expenses[:20]
    )
    cat_rows = "".join(
        f"<tr><td style='padding:6px'>{cat}</td>"
        f"<td style='padding:6px;text-align:right'>₹{amt:,.0f}</td></tr>"
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