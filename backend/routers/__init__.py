# Router package — exports all sub-routers for main.py
from routers import auth, upload, ask, library, quiz, youtube, dashboard, jobs

__all__ = ["auth", "upload", "ask", "library", "quiz", "youtube", "dashboard", "jobs"]
