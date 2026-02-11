import re
from typing import Optional


def validate_phone_number(phone: str) -> bool:
    """
    Validate Indonesian phone number format.

    Valid formats:
    - 08xxxxxxxxx (10-13 digits starting with 08)
    - +62xxxxxxxxx
    - 62xxxxxxxxx
    """
    if not phone:
        return False

    # Remove spaces and dashes
    cleaned = re.sub(r"[\s\-]", "", phone)

    # Check various formats
    patterns = [
        r"^08\d{8,11}$",  # 08xxxxxxxxx
        r"^\+62\d{9,12}$",  # +62xxxxxxxxx
        r"^62\d{9,12}$",  # 62xxxxxxxxx
    ]

    return any(re.match(pattern, cleaned) for pattern in patterns)


def validate_email(email: str) -> bool:
    """Validate email format."""
    if not email:
        return False

    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email))


def validate_plate_number(plate: str) -> bool:
    """
    Validate Indonesian vehicle plate number format.

    Format: [Region Code] [Numbers] [Letters]
    Example: B 1234 ABC, DK 123 A
    """
    if not plate:
        return False

    # Remove spaces
    cleaned = re.sub(r"\s+", "", plate.upper())

    # Pattern: 1-2 letters, 1-4 numbers, 1-3 letters
    pattern = r"^[A-Z]{1,2}\d{1,4}[A-Z]{1,3}$"
    return bool(re.match(pattern, cleaned))


def validate_npwp(npwp: str) -> bool:
    """
    Validate Indonesian NPWP (tax ID) format.

    Format: XX.XXX.XXX.X-XXX.XXX
    """
    if not npwp:
        return True  # NPWP is often optional

    # Remove dots and dashes
    cleaned = re.sub(r"[\.\-]", "", npwp)

    # Should be 15 digits
    return bool(re.match(r"^\d{15}$", cleaned))


def validate_nik(nik: str) -> bool:
    """
    Validate Indonesian NIK (national ID) format.

    Format: 16 digits
    """
    if not nik:
        return True  # NIK might be optional

    # Remove spaces
    cleaned = re.sub(r"\s", "", nik)

    return bool(re.match(r"^\d{16}$", cleaned))


def sanitize_string(text: Optional[str], max_length: int = 255) -> Optional[str]:
    """
    Sanitize a string input.

    - Strip whitespace
    - Limit length
    - Remove potentially dangerous characters
    """
    if text is None:
        return None

    # Strip whitespace
    text = text.strip()

    # Limit length
    text = text[:max_length]

    return text


def normalize_phone_number(phone: str) -> str:
    """
    Normalize phone number to standard format (08xxxxxxxxx).
    """
    if not phone:
        return phone

    # Remove spaces and dashes
    cleaned = re.sub(r"[\s\-]", "", phone)

    # Convert +62 or 62 to 0
    if cleaned.startswith("+62"):
        cleaned = "0" + cleaned[3:]
    elif cleaned.startswith("62"):
        cleaned = "0" + cleaned[2:]

    return cleaned
