from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.database import SessionLocal
from app.models.trip import Trip, TripExpense, TripMember, ExpenseSplit
from app.schemas.trip_schema import MemberCreate, ExpenseSplitRequest
from app.core.security import decode_token

router = APIRouter(prefix="/trips", tags=["splits"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user_id(authorization: str = Header(...)) -> int:
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        return int(payload.get("sub"))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_trip_or_404(trip_id: int, user_id: int, db: Session) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == user_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


# -- Members ------------------------------------------------------------------

@router.post("/{trip_id}/members", status_code=201)
def add_member(
    trip_id: int,
    data: MemberCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    member = TripMember(trip_id=trip_id, user_id=user_id, name=data.name, email=data.email)
    db.add(member)
    db.commit()
    db.refresh(member)
    return {"id": member.id, "name": member.name, "email": member.email}


@router.get("/{trip_id}/members")
def get_members(
    trip_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    members = db.query(TripMember).filter(TripMember.trip_id == trip_id).all()
    return [{"id": m.id, "name": m.name, "email": m.email} for m in members]


@router.delete("/{trip_id}/members/{member_id}", status_code=204)
def delete_member(
    trip_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    member = db.query(TripMember).filter(
        TripMember.id == member_id,
        TripMember.trip_id == trip_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()


# -- Splits -------------------------------------------------------------------

@router.post("/{trip_id}/expenses/{expense_id}/splits", status_code=201)
def add_splits(
    trip_id: int,
    expense_id: int,
    data: ExpenseSplitRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    expense = db.query(TripExpense).filter(
        TripExpense.id == expense_id,
        TripExpense.trip_id == trip_id
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    db.query(ExpenseSplit).filter(ExpenseSplit.trip_expense_id == expense_id).delete()

    for s in data.splits:
        split = ExpenseSplit(
            trip_expense_id=expense_id,
            member_id=s.member_id,
            amount=s.amount,
            paid=s.paid,
        )
        db.add(split)
    db.commit()
    return {"message": "Splits saved successfully"}


@router.get("/{trip_id}/expenses/{expense_id}/splits")
def get_splits(
    trip_id: int,
    expense_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    splits = db.query(ExpenseSplit).filter(
        ExpenseSplit.trip_expense_id == expense_id
    ).all()
    return [
        {
            "id": s.id,
            "member_id": s.member_id,
            "member_name": s.member.name,
            "amount": s.amount,
            "paid": s.paid,
        }
        for s in splits
    ]


@router.patch("/{trip_id}/expenses/{expense_id}/splits/{split_id}/paid")
def mark_paid(
    trip_id: int,
    expense_id: int,
    split_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    split = db.query(ExpenseSplit).filter(ExpenseSplit.id == split_id).first()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    was_paid = split.paid
    split.paid = not split.paid
    db.commit()

    new_split = None

    # If we just marked as PAID, check if there is remaining balance unpaid
    if split.paid and not was_paid:
        all_splits = db.query(ExpenseSplit).filter(
            ExpenseSplit.trip_expense_id == expense_id
        ).all()

        expense = db.query(TripExpense).filter(TripExpense.id == expense_id).first()
        total_expense = expense.amount if expense else 0
        total_split_amount = sum(s.amount for s in all_splits)
        total_paid = sum(s.amount for s in all_splits if s.paid)
        remaining = round(total_expense - total_paid, 2)

        # If there is still an unpaid balance, create a new split for it
        if remaining > 0:
            new_split = ExpenseSplit(
                trip_expense_id=expense_id,
                member_id=split.member_id,
                amount=remaining,
                paid=False,
            )
            db.add(new_split)
            db.commit()
            db.refresh(new_split)

    response = {"paid": split.paid}
    if new_split:
        response["new_split_created"] = {
            "id": new_split.id,
            "member_id": new_split.member_id,
            "amount": new_split.amount,
            "paid": new_split.paid,
            "message": f"New split of ₹{new_split.amount} created for remaining balance",
        }

    return response


# -- Settlement Summary -------------------------------------------------------

@router.get("/{trip_id}/settlement")
def get_settlement(
    trip_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    members = db.query(TripMember).filter(TripMember.trip_id == trip_id).all()
    expenses = db.query(TripExpense).filter(TripExpense.trip_id == trip_id).all()

    balances = {m.id: {"name": m.name, "paid": 0.0, "owes": 0.0} for m in members}

    for expense in expenses:
        for split in expense.splits:
            if split.member_id in balances:
                balances[split.member_id]["owes"] += split.amount
                if split.paid:
                    balances[split.member_id]["paid"] += split.amount

    result = []
    for member_id, data in balances.items():
        net = data["paid"] - data["owes"]
        result.append({
            "member_id": member_id,
            "name": data["name"],
            "total_paid": round(data["paid"], 2),
            "total_owes": round(data["owes"], 2),
            "net": round(net, 2),
            "status": "settled" if net >= 0 else "owes",
        })

    return result
