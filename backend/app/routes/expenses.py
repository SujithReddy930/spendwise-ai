from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Header,
)

from sqlalchemy.orm import Session

from pydantic import (
    BaseModel,
    EmailStr,
)

from typing import Optional
from datetime import datetime
import smtplib
import os

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.database import SessionLocal
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate
from app.core.security import decode_token

router = APIRouter(
    prefix="/expenses",
    tags=["Expenses"],
)

SMTP_EMAIL = os.getenv(
    "SMTP_EMAIL",
    "",
)

SMTP_PASSWORD = os.getenv(
    "SMTP_PASSWORD",
    "",
)


# DATABASE SESSION

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# AUTH HELPERS

def get_current_user_id(
    authorization: Optional[str] = Header(None),
) -> Optional[int]:

    if (
        not authorization
        or not authorization.startswith(
            "Bearer "
        )
    ):
        return None

    token = authorization.split(
        " "
    )[1]

    payload = decode_token(token)

    if not payload:
        return None

    try:
        return int(
            payload.get("sub")
        )

    except Exception:
        return None


# CREATE EXPENSE

@router.post("/")
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(
        authorization
    )

    expense_date = datetime.utcnow()

    if getattr(data, "date", None):
        try:
            expense_date = datetime.strptime(
                data.date,
                "%Y-%m-%d",
            )

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


# GET EXPENSES

@router.get("/")
def get_expenses(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(
        authorization
    )

    if not user_id:
        return []

    return (
        db.query(Expense)
        .filter(
            Expense.user_id == user_id
        )
        .order_by(
            Expense.id.desc()
        )
        .all()
    )


# DELETE EXPENSE

@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(
        authorization
    )

    expense = (
        db.query(Expense)
        .filter(
            Expense.id == expense_id,
            Expense.user_id == user_id,
        )
        .first()
    )

    if not expense:
        return {
            "message":
            "Expense not found"
        }

    db.delete(expense)

    db.commit()

    return {
        "message":
        "Expense deleted"
    }


# HELPERS

def _filter_by_month(
    expenses,
    month,
    year,
):
    result = []

    for e in expenses:

        d = getattr(
            e,
            "date",
            None,
        )

        if (
            d
            and isinstance(
                d,
                datetime,
            )
        ):
            if (
                d.month == month
                and d.year == year
            ):
                result.append(e)

        else:
            result.append(e)

    return result


# SUMMARY

@router.get("/summary")
def get_summary(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(
        authorization
    )

    query = db.query(Expense)

    if user_id:
        query = query.filter(
            Expense.user_id == user_id
        )

    expenses = query.all()

    month_expenses = _filter_by_month(
        expenses,
        month,
        year,
    )

    total = sum(
        e.amount
        for e in month_expenses
    )

    by_category = {}

    for e in month_expenses:

        by_category[e.category] = round(
            by_category.get(
                e.category,
                0,
            )
            + e.amount,
            2,
        )

    return {
        "total": round(
            total,
            2,
        ),
        "by_category":
        by_category,
        "count":
        len(month_expenses),
    }


# INSIGHTS

@router.get("/insights")
def get_insights():
    return {
        "message":
        "Insights endpoint active"
    }


# PREDICTION

@router.get("/prediction")
def get_prediction():
    return {
        "message":
        "Prediction endpoint active"
    }


# EMAIL REPORT

class EmailReportRequest(
    BaseModel
):
    email: EmailStr


@router.post("/send-report")
def send_report(
    req: EmailReportRequest,
):
    if (
        not SMTP_EMAIL
        or not SMTP_PASSWORD
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Email not configured."
            ),
        )

    try:
        msg = MIMEMultipart(
            "alternative"
        )

        msg["Subject"] = (
            "SpendWise Report"
        )

        msg["From"] = SMTP_EMAIL

        msg["To"] = req.email

        msg.attach(
            MIMEText(
                "<h1>SpendWise Report</h1>",
                "html",
            )
        )

        with smtplib.SMTP_SSL(
            "smtp.gmail.com",
            465,
        ) as smtp:

            smtp.login(
                SMTP_EMAIL,
                SMTP_PASSWORD,
            )

            smtp.sendmail(
                SMTP_EMAIL,
                req.email,
                msg.as_string(),
            )

        return {
            "message":
            f"Report sent to {req.email}"
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )