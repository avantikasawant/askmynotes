"""Tests for /auth/register, /auth/login, /auth/me endpoints."""
import pytest


def test_register_new_user(client):
    res = client.post("/auth/register", json={
        "name": "Alice",
        "email": "alice@test.com",
        "password": "securepass",
        "mobile": "9999999999",
    })
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["email"] == "alice@test.com"
    assert data["name"] == "Alice"


def test_register_duplicate_email(client):
    payload = {"name": "Bob", "email": "bob@test.com", "password": "pass", "mobile": ""}
    client.post("/auth/register", json=payload)
    # Second registration with same email should fail
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 400


def test_login_correct_credentials(client):
    client.post("/auth/register", json={
        "name": "Carol",
        "email": "carol@test.com",
        "password": "mypassword",
        "mobile": "",
    })
    res = client.post("/auth/login", json={
        "email": "carol@test.com",
        "password": "mypassword",
    })
    assert res.status_code == 200
    assert "token" in res.json()


def test_login_wrong_password(client):
    client.post("/auth/register", json={
        "name": "Dave",
        "email": "dave@test.com",
        "password": "correct",
        "mobile": "",
    })
    res = client.post("/auth/login", json={
        "email": "dave@test.com",
        "password": "wrong",
    })
    assert res.status_code == 401


def test_login_unknown_email(client):
    res = client.post("/auth/login", json={
        "email": "nobody@test.com",
        "password": "anything",
    })
    assert res.status_code == 401


def test_get_me_authenticated(client, auth_token):
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {auth_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "email" in data
    assert "name" in data


def test_get_me_unauthenticated(client):
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_get_me_invalid_token(client):
    res = client.get("/auth/me", headers={"Authorization": "Bearer not.a.real.token"})
    assert res.status_code == 401
