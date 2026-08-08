"""Local account primitives used by the DFDS monitoring backend."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re


PASSWORD_ITERATIONS = 310_000
USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{1,63}$")
REGISTRATION_USERNAME_PATTERN = re.compile(r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z0-9._-]{4,64}$")


def normalize_username(value: object) -> str:
    username = str(value or "").strip().lower()
    if not USERNAME_PATTERN.fullmatch(username):
        raise ValueError("Username must contain 2-64 lowercase letters, numbers, dots, underscores, or hyphens")
    return username


def validate_registration_username(value: object) -> str:
    username = str(value or "").strip()
    if not REGISTRATION_USERNAME_PATTERN.fullmatch(username):
        raise ValueError(
            "Username must contain an uppercase letter, lowercase letter, and number; "
            "use 4-64 letters, numbers, dots, underscores, or hyphens"
        )
    return normalize_username(username)


def hash_password(password: str) -> str:
    if len(password) < 6:
        raise ValueError("Password must contain at least 6 characters")
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
