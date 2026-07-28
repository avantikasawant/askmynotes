import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_NAME = "AskMyNotes"


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an HTML email. Fails silently (logs only) so auth flows never break if SMTP is down."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[mailer] SMTP not configured — skipped email to {to_email}")
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[mailer] failed to send to {to_email}: {e}")
        return False


def send_login_alert(to_email: str, name: str):
    subject = "New login to your AskMyNotes account"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;">
      <h2 style="color:#4F46E5;">Hi {name},</h2>
      <p>We noticed a new login to your AskMyNotes account just now.</p>
      <p>If this was you, no action is needed.</p>
      <p>If you don't recognize this activity, please reset your password right away.</p>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">AskMyNotes · Automated security notice</p>
    </div>"""
    send_email(to_email, subject, html)


def send_password_reset(to_email: str, name: str, reset_link: str):
    subject = "Reset your AskMyNotes password"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;">
      <h2 style="color:#4F46E5;">Hi {name},</h2>
      <p>We received a request to reset your AskMyNotes password.</p>
      <p>
        <a href="{reset_link}"
           style="display:inline-block;background:#4F46E5;color:#fff;padding:12px 24px;
                  border-radius:10px;text-decoration:none;font-weight:600;">
          Reset Password
        </a>
      </p>
      <p style="font-size:13px;color:#6B7280;">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">AskMyNotes · Automated security notice</p>
    </div>"""
    send_email(to_email, subject, html)
