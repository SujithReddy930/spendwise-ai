from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from app.database import get_db
from app.models.user import User
from app.core.security import (
    hash_password, verify_password, create_access_token,
    generate_reset_token, validate_password_strength
)
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILED_ATTEMPTS = 3
LOCK_DURATION_MINUTES = 15

# ── Schemas ──────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# ── Email Helper ─────────────────────────────────────────────

def send_reset_email(to_email: str, reset_token: str, user_name: str):
    """Send password reset email. Works with Gmail SMTP."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    if not smtp_user or not smtp_pass:
        # Dev mode — print to console instead of sending email
        print(f"\n{'='*50}")
        print(f"PASSWORD RESET LINK (dev mode)")
        print(f"User: {user_name} ({to_email})")
        print(f"Link: {reset_link}")
        print(f"{'='*50}\n")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "SpendWise AI — Reset Your Password"
        msg["From"] = f"SpendWise AI <{smtp_user}>"
        msg["To"] = to_email

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#111;color:#fff;border-radius:16px;padding:32px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
            <div style="width:32px;height:32px;background:#10b981;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">💰</div>
            <span style="font-weight:bold;font-size:18px;">SpendWise AI</span>
          </div>
          <h2 style="margin:0 0 8px;">Reset Your Password</h2>
          <p style="color:#9ca3af;margin:0 0 24px;">Hi {user_name}, we received a request to reset your password.</p>
          <a href="{reset_link}"
             style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:bold;margin-bottom:24px;">
            Reset Password
          </a>
          <p style="color:#6b7280;font-size:13px;">This link expires in <strong>30 minutes</strong>.</p>
          <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border-color:#2a2a2a;margin:24px 0;">
          <p style="color:#4b5563;font-size:12px;">Or copy this link: {reset_link}</p>
        </div>
        """

        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())

    except Exception as e:
        print(f"Email send failed: {e}")
        print(f"Reset link (fallback): {reset_link}")

# ── Routes ───────────────────────────────────────────────────

@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    # Check duplicate
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate password strength
    valid, msg = validate_password_strength(data.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email}
    }


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

    # User not found — generic message to prevent email enumeration
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check if account is locked
    if user.locked_until and datetime.utcnow() < user.locked_until:
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=423,
            detail=f"Account locked due to too many failed attempts. Try again in {remaining} minute(s)."
        )

    # Wrong password
    if not verify_password(data.password, user.hashed_password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1

        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.utcnow() + timedelta(minutes=LOCK_DURATION_MINUTES)
            user.failed_login_attempts = 0
            db.commit()
            raise HTTPException(
                status_code=423,
                detail=f"Too many failed attempts. Account locked for {LOCK_DURATION_MINUTES} minutes."
            )

        attempts_left = MAX_FAILED_ATTEMPTS - user.failed_login_attempts
        db.commit()
        raise HTTPException(
            status_code=401,
            detail=f"Invalid email or password. {attempts_left} attempt(s) remaining before lockout."
        )

    # Success — reset failed attempts
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email}
    }


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

    # Always return success — prevents email enumeration attacks
    if not user:
        return {"message": "If this email is registered, a reset link has been sent."}

    # Generate secure token
    token = generate_reset_token()
    user.reset_token = token
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=30)
    db.commit()

    send_reset_email(data.email, token, user.name)

    return {"message": "If this email is registered, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == data.token).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if not user.reset_token_expiry or datetime.utcnow() > user.reset_token_expiry:
        # Clear expired token
        user.reset_token = None
        user.reset_token_expiry = None
        db.commit()
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")

    # Validate new password strength
    valid, msg = validate_password_strength(data.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    # Update password and clear token
    user.hashed_password = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

    return {"message": "Password reset successfully. You can now log in."}


@router.get("/check-lock/{email}")
def check_lock_status(email: str, db: Session = Depends(get_db)):
    """Frontend can poll this to show countdown timer."""
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.locked_until:
        return {"locked": False}
    if datetime.utcnow() >= user.locked_until:
        return {"locked": False}
    remaining_seconds = int((user.locked_until - datetime.utcnow()).total_seconds())
    return {"locked": True, "remaining_seconds": remaining_seconds}