"""Reject obvious passwords when a user chooses a lasting password."""

import re
import unicodedata


COMMON_PASSWORDS = {
    "12345678", "123456789", "1234567890", "11111111", "00000000",
    "abcdefgh", "abcdefghi", "qwertyui", "qwertyuiop", "asdfghjk",
    "zxcvbnm", "football", "baseball", "sunshine", "princess",
    "monkey123", "dragon123", "trustno1", "password1", "password123",
}
COMMON_PREFIXES = (
    "password", "admin", "administrator", "qwerty", "welcome",
    "letmein", "changeme", "iloveyou", "casevault", "secret", "test123",
)
SEQUENCES = ("0123456789", "123456789", "9876543210", "987654321",
             "abcdefghijklmnopqrstuvwxyz", "zyxwvutsrqponmlkjihgfedcba")
LEET_CHARS = str.maketrans({"@": "a", "0": "o", "$": "s", "5": "s"})


def is_common_password(password: str) -> bool:
    normalized = unicodedata.normalize("NFKC", password).casefold()
    compact = re.sub(r"[^a-z0-9]", "", normalized)
    lookalike = re.sub(r"[^a-z0-9]", "", normalized.translate(LEET_CHARS))
    if not compact or compact in COMMON_PASSWORDS or lookalike in COMMON_PASSWORDS:
        return True
    if any(re.fullmatch(rf"{prefix}[0-9]{{0,8}}", candidate)
           for prefix in COMMON_PREFIXES for candidate in (compact, lookalike)):
        return True
    if any(compact in sequence * 3 for sequence in SEQUENCES):
        return True
    if any(len(compact) % size == 0 and compact == compact[:size] * (len(compact) // size)
           for size in range(1, min(4, len(compact) // 2) + 1)):
        return True
    return len(set(compact)) == 1
