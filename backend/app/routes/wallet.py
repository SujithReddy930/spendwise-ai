# backend/app/routes/wallet.py
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import SessionLocal
from app.models.wallet import TripWallet, WalletDeposit, WalletTransaction
from app.models.trip import Trip
from app.schemas.wallet_schema import WalletCreate, DepositCreate, DepositStatusUpdate
from app.core.security import decode_token

router = APIRouter(prefix="/trips", tags=["wallet"])


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


def get_wallet_or_404(trip_id: int, db: Session) -> TripWallet:
    wallet = db.query(TripWallet).filter(TripWallet.trip_id == trip_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found. Create one first.")
    return wallet


# ── Create Wallet ────────────────────────────────────────────────────────────

@router.post("/{trip_id}/wallet", status_code=201)
def create_wallet(
    trip_id: int,
    data: WalletCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    existing = db.query(TripWallet).filter(TripWallet.trip_id == trip_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Wallet already exists for this trip")
    wallet = TripWallet(trip_id=trip_id, manager_member_id=data.manager_member_id)
    db.add(wallet)
    db.commit()
    db.refresh(wallet)
    return {"id": wallet.id, "trip_id": wallet.trip_id, "balance": wallet.balance,
            "manager_member_id": wallet.manager_member_id, "message": "Wallet created"}


# ── Get Wallet Dashboard ─────────────────────────────────────────────────────

@router.get("/{trip_id}/wallet")
def get_wallet(
    trip_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    wallet = get_wallet_or_404(trip_id, db)

    received_deposits = [d for d in wallet.deposits if d.status == "received"]
    pending_deposits = [d for d in wallet.deposits if d.status == "pending"]
    total_received = sum(d.amount for d in received_deposits)
    total_pending = sum(d.amount for d in pending_deposits)

    return {
        "id": wallet.id,
        "trip_id": wallet.trip_id,
        "manager_member_id": wallet.manager_member_id,
        "balance": round(total_received - wallet.total_expenses, 2),
        "total_deposits_received": round(total_received, 2),
        "total_deposits_pending": round(total_pending, 2),
        "total_expenses": round(wallet.total_expenses, 2),
        "deposits": [
            {
                "id": d.id,
                "member_id": d.member_id,
                "amount": d.amount,
                "status": d.status,
                "notes": d.notes,
                "deposit_date": d.deposit_date.isoformat() if d.deposit_date else None,
                "received_at": d.received_at.isoformat() if d.received_at else None,
            }
            for d in sorted(wallet.deposits, key=lambda x: x.created_at, reverse=True)
        ],
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "tx_type": t.tx_type,
                "description": t.description,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in sorted(wallet.transactions, key=lambda x: x.created_at, reverse=True)
        ],
    }


# ── Update Manager ───────────────────────────────────────────────────────────

@router.patch("/{trip_id}/wallet/manager")
def update_manager(
    trip_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    wallet = get_wallet_or_404(trip_id, db)
    wallet.manager_member_id = payload.get("manager_member_id")
    db.commit()
    return {"message": "Manager updated", "manager_member_id": wallet.manager_member_id}


# ── Deposits ─────────────────────────────────────────────────────────────────

@router.post("/{trip_id}/wallet/deposits", status_code=201)
def add_deposit(
    trip_id: int,
    data: DepositCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    wallet = get_wallet_or_404(trip_id, db)
    deposit = WalletDeposit(
        wallet_id=wallet.id,
        member_id=data.member_id,
        amount=data.amount,
        notes=data.notes,
        deposit_date=data.deposit_date or datetime.utcnow(),
        status="pending",
    )
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return {
        "id": deposit.id,
        "member_id": deposit.member_id,
        "amount": deposit.amount,
        "status": deposit.status,
        "notes": deposit.notes,
        "deposit_date": deposit.deposit_date.isoformat(),
    }


@router.patch("/{trip_id}/wallet/deposits/{deposit_id}/status")
def update_deposit_status(
    trip_id: int,
    deposit_id: int,
    data: DepositStatusUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    wallet = get_wallet_or_404(trip_id, db)
    deposit = db.query(WalletDeposit).filter(
        WalletDeposit.id == deposit_id,
        WalletDeposit.wallet_id == wallet.id
    ).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")

    prev_status = deposit.status
    deposit.status = data.status

    # If marking as received, add to wallet balance and log transaction
    if data.status == "received" and prev_status != "received":
        deposit.received_at = datetime.utcnow()
        wallet.total_deposits += deposit.amount
        tx = WalletTransaction(
            wallet_id=wallet.id,
            amount=deposit.amount,
            tx_type="deposit",
            description=f"Deposit received from member #{deposit.member_id}",
        )
        db.add(tx)

    # If unmarking received, subtract from wallet balance
    elif prev_status == "received" and data.status == "pending":
        deposit.received_at = None
        wallet.total_deposits = max(0, wallet.total_deposits - deposit.amount)

    db.commit()
    return {"message": f"Deposit marked as {data.status}", "deposit_id": deposit_id}


@router.delete("/{trip_id}/wallet/deposits/{deposit_id}", status_code=204)
def delete_deposit(
    trip_id: int,
    deposit_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    wallet = get_wallet_or_404(trip_id, db)
    deposit = db.query(WalletDeposit).filter(
        WalletDeposit.id == deposit_id,
        WalletDeposit.wallet_id == wallet.id
    ).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.status == "received":
        wallet.total_deposits = max(0, wallet.total_deposits - deposit.amount)
    db.delete(deposit)
    db.commit()


# ── Record Wallet Expense ─────────────────────────────────────────────────────

@router.post("/{trip_id}/wallet/expense")
def record_wallet_expense(
    trip_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    get_trip_or_404(trip_id, user_id, db)
    wallet = get_wallet_or_404(trip_id, db)
    amount = float(payload.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be > 0")
    wallet.total_expenses += amount
    tx = WalletTransaction(
        wallet_id=wallet.id,
        expense_id=payload.get("expense_id"),
        amount=amount,
        tx_type="expense",
        description=payload.get("description", "Trip expense"),
    )
    db.add(tx)
    db.commit()
    return {"message": "Expense recorded", "new_balance": round(wallet.total_deposits - wallet.total_expenses, 2)}