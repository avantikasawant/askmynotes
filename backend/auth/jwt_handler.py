import os
import jwt
from datetime import datetime, timedelta, timezone

ALGORITHM = "HS256"
EXPIRE_HOURS = 72

def _secret() -> str:
    return os.getenv("JWT_SECRET", "askmynotes_fallback_secret")

def create_token(email: str, name: str) -> str:
    payload = {
        "sub": email,
        "name": name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS)
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")
