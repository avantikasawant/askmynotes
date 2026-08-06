"""Auth routes: register, login, forgot/reset password, profile."""
import logging
import os
import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from auth.db import (
    create_user, get_user_by_email, verify_password, update_profile, log_activity,
    create_reset_token, consume_reset_token,
)
from auth.jwt_handler import create_token, create_refresh_token, decode_refresh_token
from auth.models import UserRegister, UserLogin, GoogleLogin, UserProfile
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/tokeninfo"


@router.post("/register", status_code=201)
async def register(payload: UserRegister):
    ok = create_user(payload.name, payload.email, payload.password, payload.mobile or "")
    if not ok:
        raise HTTPException(status_code=400, detail="Email already registered")
    token = create_token(payload.email, payload.name)
    refresh = create_refresh_token(payload.email)
    log_activity(payload.email, "registered")
    logger.info("New user registered: %s", payload.email)
    return {"token": token, "refresh_token": refresh, "name": payload.name, "email": payload.email}


@router.post("/login")
async def login(payload: UserLogin):
    if not verify_password(payload.email, payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = get_user_by_email(payload.email)
    token = create_token(payload.email, user["name"])
    refresh = create_refresh_token(payload.email)
    logger.info("User logged in: %s", payload.email)
    return {"token": token, "refresh_token": refresh, "name": user["name"], "email": payload.email}


@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """Exchange a refresh token for a new access token."""
    try:
        claims = decode_refresh_token(refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    user = get_user_by_email(claims["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token = create_token(claims["sub"], user["name"])
    return {"token": token}


@router.post("/google")
async def google_login(payload: GoogleLogin):
    """
    Accept either:
      - access_token  (from useGoogleLogin popup/implicit flow)
      - token / id_token (legacy FedCM flow — kept for backward compat)
    """
    access_token = getattr(payload, "access_token", None) or getattr(payload, "token", None)
    if not access_token:
        raise HTTPException(status_code=400, detail="Missing Google token")

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Try userinfo endpoint first (access_token flow)
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code == 200:
            info = userinfo_resp.json()
        else:
            # Fallback: try tokeninfo endpoint (id_token flow)
            tokeninfo_resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": access_token},
            )
            if tokeninfo_resp.status_code != 200 or "error" in tokeninfo_resp.json():
                raise HTTPException(status_code=401, detail="Invalid Google token")
            info = tokeninfo_resp.json()

    email = info.get("email")
    name = info.get("name") or info.get("email", "").split("@")[0]
    google_id = info.get("sub", "")

    if not email:
        raise HTTPException(status_code=401, detail="Could not retrieve email from Google")

    user = get_user_by_email(email)
    if not user:
        create_user(name, email, "", "", google_id)
        log_activity(email, "registered", "google")
        logger.info("New Google OAuth user: %s", email)
    token = create_token(email, name)
    refresh = create_refresh_token(email)
    return {"token": token, "refresh_token": refresh, "name": name, "email": email}


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    db_user = get_user_by_email(user["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "name": db_user["name"],
        "email": db_user["email"],
        "mobile": db_user["mobile"],
        "created_at": db_user["created_at"],
    }


@router.put("/profile")
async def update_user_profile(payload: UserProfile, user: dict = Depends(get_current_user)):
    update_profile(user["sub"], payload.name, payload.mobile or "")
    logger.info("Profile updated for: %s", user["sub"])
    return {"status": "updated"}


# ── Forgot / Reset password ────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


def _send_reset_email(to_email: str, otp: str) -> bool:
    """Send OTP via Gmail SMTP. Returns True on success."""
    import smtplib
    from email.mime.text import MIMEText
    smtp_user = os.getenv("SMTP_EMAIL")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    if not smtp_user or not smtp_pass:
        logger.warning("SMTP not configured — OTP for %s is: %s", to_email, otp)
        return False
    try:
        msg = MIMEText(
            f"""Hi,

Your AskMyNotes password reset code is:

    {otp}

This code expires in 15 minutes. If you didn't request a reset, ignore this email.

— AskMyNotes Team"""
        )
        msg["Subject"] = f"AskMyNotes — Password Reset Code: {otp}"
        msg["From"] = smtp_user
        msg["To"] = to_email
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as s:
            s.login(smtp_user, smtp_pass)
            s.send_message(msg)
        logger.info("Reset OTP emailed to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send reset email to %s: %s", to_email, e)
        return False


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    """
    Request a password reset OTP.
    Always returns 200 to prevent email enumeration.
    """
    otp = create_reset_token(payload.email)
    if otp:
        email_sent = _send_reset_email(payload.email, otp)
        if not email_sent:
            # Dev fallback: return OTP in response (remove in strict production)
            return {
                "status": "ok",
                "message": "Email service not configured.",
                "dev_otp": otp,   # shown in UI for testing
            }
    return {"status": "ok", "message": "If this email is registered, a reset code has been sent."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    """Validate OTP and set the new password."""
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    ok = consume_reset_token(payload.email, payload.otp.strip(), payload.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    logger.info("Password reset for: %s", payload.email)
    return {"status": "ok", "message": "Password updated successfully. You can now sign in."}
