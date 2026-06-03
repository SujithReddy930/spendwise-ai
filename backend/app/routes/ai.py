# backend/app/routes/ai.py
import os
import json
from datetime import datetime
from calendar import monthrange
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from google import genai

from app.database import get_db
from app.models.expense import Expense
from app.models.ai_models import AIInsight, AIPrediction
from app.core.security import decode_token

router = APIRouter(prefix="/ai", tags=["AI"])

# ── Gemini client ──────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
GEMINI_MODEL = "gemini-1.5-flash"

# Add this endpoint to backend/app/routes/ai.py
# Place it after the existing router = APIRouter(...) line and imports

from pydantic import BaseModel

class CategorizeRequest(BaseModel):
    title: str

CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Education", "Other"]

@router.post("/categorize")
async def categorize_expense(req: CategorizeRequest):
    """Use Gemini to suggest a category for an expense title."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"category": "Other", "confidence": 0}

    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""You are a personal finance categorizer.
Given this expense title: "{req.title}"
Classify it into exactly one of these categories: {', '.join(CATEGORIES)}
Reply with ONLY a JSON object like: {{"category": "Food", "confidence": 92}}
Confidence is 0-100. No explanation, no markdown."""

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        text = response.text.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        if data.get("category") not in CATEGORIES:
            data["category"] = "Other"
        return data
    except Exception:
        return {"category": "Other", "confidence": 0}

# ── Auth helper ────────────────────────────────────────────────────────────────

def get_current_user_id(authorization: Optional[str] = Header(None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    try:
        return int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Expense data helper ────────────────────────────────────────────────────────

def get_month_expenses(db: Session, user_id: int, month: int, year: int):
    expenses = (
        db.query(Expense)
        .filter(Expense.user_id == user_id)
        .all()
    )
    return [
        e for e in expenses
        if isinstance(e.date, datetime) and e.date.month == month and e.date.year == year
    ]


def build_expense_summary(expenses: list, month: int, year: int) -> dict:
    total = sum(e.amount for e in expenses)
    by_cat = {}
    by_payment = {}
    for e in expenses:
        by_cat[e.category] = round(by_cat.get(e.category, 0) + e.amount, 2)
        pm = e.payment_method or "UPI"
        by_payment[pm] = round(by_payment.get(pm, 0) + e.amount, 2)

    today = datetime.utcnow()
    days_in_month = monthrange(year, month)[1]
    is_current = month == today.month and year == today.year
    days_elapsed = today.day if is_current else days_in_month
    daily_avg = round(total / days_elapsed, 2) if days_elapsed > 0 else 0

    return {
        "month": datetime(year, month, 1).strftime("%B %Y"),
        "total_spent": round(total, 2),
        "transaction_count": len(expenses),
        "daily_average": daily_avg,
        "days_elapsed": days_elapsed,
        "days_in_month": days_in_month,
        "by_category": by_cat,
        "by_payment_method": by_payment,
        "top_category": max(by_cat, key=by_cat.get) if by_cat else None,
        "lowest_category": min(by_cat, key=by_cat.get) if by_cat else None,
    }


# ── POST /ai/insights ──────────────────────────────────────────────────────────

@router.post("/insights")
def get_ai_insights(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    if not client:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    expenses = get_month_expenses(db, user_id, month, year)

    if not expenses:
        return {
            "insights": ["No expenses found for this month. Start adding expenses to get AI insights!"],
            "cached": False,
        }

    summary = build_expense_summary(expenses, month, year)

    prompt = f"""
You are a personal finance advisor for an Indian user. Analyze their spending data and provide 5 actionable, specific insights.

Spending Data for {summary['month']}:
- Total Spent: ₹{summary['total_spent']:,}
- Transactions: {summary['transaction_count']}
- Daily Average: ₹{summary['daily_average']:,}
- Days Elapsed: {summary['days_elapsed']} of {summary['days_in_month']}
- By Category: {json.dumps(summary['by_category'])}
- By Payment Method: {json.dumps(summary['by_payment_method'])}
- Top Spending Category: {summary['top_category']}
- Lowest Spending Category: {summary['lowest_category']}

Provide exactly 5 insights as a JSON array of strings. Each insight should be:
- Specific with actual rupee amounts
- Actionable with a concrete tip
- Conversational and encouraging
- 1-2 sentences max

Respond ONLY with a valid JSON array, no markdown, no explanation. Example format:
["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"]
"""

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        raw = response.text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        insights = json.loads(raw.strip())
        if not isinstance(insights, list):
            insights = [str(insights)]
    except json.JSONDecodeError:
        # Fallback: split by newline if JSON parsing fails
        insights = [line.strip("- ").strip() for line in response.text.strip().split("\n") if line.strip()][:5]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")

    # Save to DB (upsert)
    existing = (
        db.query(AIInsight)
        .filter(AIInsight.user_id == user_id, AIInsight.month == month, AIInsight.year == year)
        .first()
    )
    if existing:
        existing.insights = insights
        existing.total_spent = summary["total_spent"]
        existing.top_category = summary["top_category"]
        existing.expense_count = summary["transaction_count"]
        existing.updated_at = datetime.utcnow()
    else:
        db.add(AIInsight(
            user_id=user_id,
            month=month,
            year=year,
            insights=insights,
            total_spent=summary["total_spent"],
            top_category=summary["top_category"],
            expense_count=summary["transaction_count"],
        ))
    db.commit()

    return {"insights": insights, "summary": summary, "cached": False}


# ── GET /ai/insights/history ───────────────────────────────────────────────────

@router.get("/insights/history")
def get_insights_history(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    records = (
        db.query(AIInsight)
        .filter(AIInsight.user_id == user_id)
        .order_by(AIInsight.year.desc(), AIInsight.month.desc())
        .limit(6)
        .all()
    )
    return [
        {
            "month": r.month,
            "year": r.year,
            "insights": r.insights,
            "total_spent": r.total_spent,
            "top_category": r.top_category,
            "generated_at": r.updated_at or r.created_at,
        }
        for r in records
    ]


# ── POST /ai/predictions ───────────────────────────────────────────────────────

@router.post("/predictions")
def get_ai_predictions(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    if not client:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    # Current month expenses
    expenses = get_month_expenses(db, user_id, month, year)
    summary = build_expense_summary(expenses, month, year)

    # Last 3 months for context
    history = []
    for i in range(1, 4):
        m = month - i if month - i > 0 else month - i + 12
        y = year if month - i > 0 else year - 1
        exps = get_month_expenses(db, user_id, m, y)
        if exps:
            s = build_expense_summary(exps, m, y)
            history.append({"month": s["month"], "total": s["total_spent"], "by_category": s["by_category"]})

    prompt = f"""
You are a financial prediction AI for an Indian user. Predict their spending for the rest of {summary['month']}.

Current Month Data ({summary['month']}):
- Spent so far: ₹{summary['total_spent']:,}
- Days elapsed: {summary['days_elapsed']} of {summary['days_in_month']}
- Daily average: ₹{summary['daily_average']:,}
- By category: {json.dumps(summary['by_category'])}

Historical Data (last 3 months):
{json.dumps(history, indent=2)}

Provide predictions as a JSON object with this exact structure:
{{
  "predicted_total": <number>,
  "confidence": "<low|medium|high>",
  "summary": "<2-3 sentence narrative prediction>",
  "breakdown": {{
    "<category>": <predicted_amount_for_full_month>
  }},
  "savings_tip": "<one specific actionable tip to save money this month>"
}}

Base confidence on data completeness: low if <30% of month elapsed, medium if 30-60%, high if >60%.
Respond ONLY with valid JSON, no markdown.
"""

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        prediction = json.loads(raw.strip())
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse Gemini prediction response")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")

    # Save to DB (upsert)
    existing = (
        db.query(AIPrediction)
        .filter(AIPrediction.user_id == user_id, AIPrediction.month == month, AIPrediction.year == year)
        .first()
    )
    if existing:
        existing.predicted_total = prediction.get("predicted_total")
        existing.confidence = prediction.get("confidence")
        existing.summary = prediction.get("summary")
        existing.breakdown = prediction.get("breakdown")
        existing.days_elapsed = summary["days_elapsed"]
        existing.days_in_month = summary["days_in_month"]
        existing.total_spent_so_far = summary["total_spent"]
        existing.updated_at = datetime.utcnow()
    else:
        db.add(AIPrediction(
            user_id=user_id,
            month=month,
            year=year,
            predicted_total=prediction.get("predicted_total"),
            confidence=prediction.get("confidence"),
            summary=prediction.get("summary"),
            breakdown=prediction.get("breakdown"),
            days_elapsed=summary["days_elapsed"],
            days_in_month=summary["days_in_month"],
            total_spent_so_far=summary["total_spent"],
        ))
    db.commit()

    return {
        "prediction": prediction,
        "current_summary": summary,
        "history": history,
    }


# ── GET /ai/predictions/history ───────────────────────────────────────────────

@router.get("/predictions/history")
def get_predictions_history(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    records = (
        db.query(AIPrediction)
        .filter(AIPrediction.user_id == user_id)
        .order_by(AIPrediction.year.desc(), AIPrediction.month.desc())
        .limit(6)
        .all()
    )
    return [
        {
            "month": r.month,
            "year": r.year,
            "predicted_total": r.predicted_total,
            "confidence": r.confidence,
            "summary": r.summary,
            "breakdown": r.breakdown,
            "generated_at": r.updated_at or r.created_at,
        }
        for r in records
    ]