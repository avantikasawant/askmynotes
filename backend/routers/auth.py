"""Auth routes: register, login, Google OAuth, profile."""
import logging
import httpx
from fastapi import APIRouter, HTTPException, Depends

from auth.db import create_user, get_user_by_email, verify_password, update_profile, log_activity
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
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(GOOGLE_TOKEN_URL, params={"id_token": payload.token})
    info = resp.json()
    if "error" in info or resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    email = info.get("email")
    name = info.get("name", email)
    google_id = info.get("sub")
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
