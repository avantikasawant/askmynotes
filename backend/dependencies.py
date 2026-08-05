"""
Shared FastAPI dependencies — imported by all routers.
"""
from fastapi import Header, HTTPException
from auth.jwt_handler import decode_token


def get_current_user(authorization: str = Header(default="")) -> dict:
    """
    FastAPI dependency that validates the Bearer token and returns the JWT claims.
    Usage:
        @router.get("/protected")
        async def route(user: dict = Depends(get_current_user)):
            ...
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        return decode_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
