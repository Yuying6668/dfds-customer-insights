"""Local account primitives used by the DFDS monitoring backend."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re


PASSWORD_ITERATIONS = 310_000
USERNAME_PATTERN = re.compile(r"^[a-z]{3,32}$")
REGISTRATION_USERNAME_PATTERN = re.compile(r"^[A-Za-z]{3,32}$")


def normalize_username(value: object) -> str:
    username = str(value or "").strip().lower()
    if not USERNAME_PATTERN.fullmatch(username):
        raise ValueError("User ID must contain only letters and be 3-32 characters long")
    return username


def validate_registration_username(value: object) -> str:
    username = str(value or "").strip()
    if not REGISTRATION_USERNAME_PATTERN.fullmatch(username):
        raise ValueError("User ID must contain only letters and be 3-32 characters long")
    return normalize_username(username)


def hash_password(password: str) -> str:
    if not re.fullmatch(r"\d{6}", str(password or "")):
        raise ValueError("Password must be exactly 6 digits")
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PASSWORD_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(derived).decode("ascii"),
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, encoded_salt, expected_hash = str(encoded).split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(encoded_salt.encode("ascii"))
        expected = base64.urlsafe_b64decode(expected_hash.encode("ascii"))
        derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(derived, expected)
    except (ValueError, TypeError, base64.binascii.Error):
        return False
