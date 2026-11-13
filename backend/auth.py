import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional
from fastapi import Request
from config import settings


def get_expected_pin() -> str:
    return (os.getenv("FAMILY_ACCESS_PIN") or settings.FAMILY_ACCESS_PIN or "0410").strip()


def get_secret_key() -> bytes:
    raw = os.getenv("SESSION_SECRET_KEY") or settings.SESSION_SECRET_KEY or "familyfinance-vault-secret-0410"
    return raw.encode("utf-8")


def verify_family_pin(candidate_pin: str) -> bool:
    """Constant-time PIN comparison using secrets.compare_digest."""
    expected = get_expected_pin()
    provided = (candidate_pin or "").strip()
    return secrets.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))


def create_signed_session_token(ttl_seconds: int = 86400 * 30) -> str:
    """Creates a signed HMAC-SHA256 session token bound to the current FAMILY_ACCESS_PIN."""
    pin_fingerprint = hashlib.sha256(get_expected_pin().encode("utf-8")).hexdigest()[:16]
    payload = {
        "sub": "family_finance_vault",
        "users": ["Saksham", "Family"],
        "pfp": pin_fingerprint,
        "iat": int(time.time()),
        "exp": int(time.time()) + ttl_seconds,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("utf-8").rstrip("=")
    sig = hmac.new(get_secret_key(), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_signed_session_token(token: str) -> bool:
    """Verifies the HMAC-SHA256 signature, expiration, and PIN fingerprint of a session token."""
    if not token or "." not in token:
        return False
    try:
        payload_b64, provided_sig = token.strip().split(".", 1)
        expected_sig = hmac.new(get_secret_key(), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
        if not secrets.compare_digest(provided_sig.encode("utf-8"), expected_sig.encode("utf-8")):
            return False

        padding = "=" * (-len(payload_b64) % 4)
        payload_json = base64.urlsafe_b64decode((payload_b64 + padding).encode("utf-8")).decode("utf-8")
        data = json.loads(payload_json)
        if int(data.get("exp", 0)) < int(time.time()):
            return False

        expected_pfp = hashlib.sha256(get_expected_pin().encode("utf-8")).hexdigest()[:16]
        if not secrets.compare_digest(str(data.get("pfp", "")), expected_pfp):
            return False
        return True
    except Exception:
        return False


def is_request_authenticated(request: Request) -> bool:
    """
    Checks if a request carries either a valid `X-Family-Pin` header or a valid
    `Authorization: Bearer <token>` session token.
    """
    pin_header: Optional[str] = request.headers.get("X-Family-Pin")
    if pin_header and verify_family_pin(pin_header):
        return True

    auth_header: Optional[str] = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if verify_signed_session_token(token):
            return True

    return False
