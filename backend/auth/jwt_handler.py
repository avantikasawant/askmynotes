import os
import jwt
from datetime import datetime, timedelta, timezone

ALGORITHM = "HS256"
EXPIRE_HOURS = 72
REFRESH_EXPIRE_DAYS = 30


def _secret() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError(
            "JWT_SECRET environment variable is not set. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    if len(secret) < 32:
        raise RuntimeError("JWT_SECRET must be at least 32 characters long")
    return secret


def create_token(email: str, name: str) -> str:
    payload = {
        "sub": email,
        "name": name,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS),
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def create_refresh_token(email: str) -> str:
    payload = {
        "sub": email,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRE_DAYS),
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
        if payload.get("type") == "refresh":
            raise ValueError("Cannot use refresh token as access token")
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired — please log in again")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {e}")


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Refresh token expired — please log in again")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid refresh token: {e}")
