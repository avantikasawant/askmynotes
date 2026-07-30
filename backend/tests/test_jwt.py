"""Unit tests for JWT handler — no app startup required."""
import os
import pytest

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-ci-only")


def test_create_and_decode_token():
    """decode_token receives the raw token (no 'Bearer ' prefix)."""
    from auth.jwt_handler import create_token, decode_token

    token = create_token("user@example.com", "Test User")
    assert isinstance(token, str)
    assert len(token) > 20

    claims = decode_token(token)   # raw token, no "Bearer " prefix
    assert claims["sub"] == "user@example.com"
    assert claims["name"] == "Test User"


def test_decode_invalid_token_raises_value_error():
    """decode_token raises ValueError for bad tokens (get_current_user converts it to 401)."""
    from auth.jwt_handler import decode_token

    with pytest.raises(ValueError, match="Invalid token"):
        decode_token("this.is.not.valid")


def test_decode_empty_string_raises_value_error():
    from auth.jwt_handler import decode_token

    with pytest.raises(ValueError):
        decode_token("")


def test_get_current_user_converts_value_error_to_http_401(client):
    """get_current_user wraps ValueError from decode_token into a 401 HTTPException."""
    res = client.get("/auth/me", headers={"Authorization": "Bearer totally.invalid.token"})
    assert res.status_code == 401


def test_get_current_user_missing_bearer_prefix(client):
    """Missing 'Bearer ' prefix → 401 immediately (before decode_token is called)."""
    res = client.get("/auth/me", headers={"Authorization": "justthetoken"})
    assert res.status_code == 401


def test_token_contains_expected_claims():
    from auth.jwt_handler import create_token, decode_token

    token = create_token("alice@test.com", "Alice")
    claims = decode_token(token)
    assert "sub" in claims
    assert "name" in claims
    assert "exp" in claims
    assert claims["sub"] == "alice@test.com"
