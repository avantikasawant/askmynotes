from pydantic import BaseModel
from typing import Optional

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    mobile: Optional[str] = ""

class UserLogin(BaseModel):
    email: str
    password: str

class GoogleLogin(BaseModel):
    token: str

class UserProfile(BaseModel):
    name: str
    email: str
    mobile: Optional[str] = ""
