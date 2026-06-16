from datetime import date, datetime, timezone, timedelta
from typing import Optional
import random
import string


JAKARTA_TZ = timezone(timedelta(hours=7))


def get_jakarta_now() -> datetime:
    """Return current datetime in Asia/Jakarta (UTC+7)."""
    return datetime.now(JAKARTA_TZ)


def get_jakarta_date() -> date:
    """Return current date in Asia/Jakarta (UTC+7)."""
    return get_jakarta_now().date()


def generate_transaction_number(prefix: str, sequence: int = None) -> str:
    """
    Generate a unique transaction number.

    Args:
        prefix: Transaction type prefix (e.g., 'TRX', 'INV', 'PO')
        sequence: Optional sequence number

    Returns:
        Formatted transaction number (e.g., 'TRX-20240115-001')
    """
    date_part = get_jakarta_now().strftime("%Y%m%d")

    if sequence is not None:
        seq_part = f"{sequence:04d}"
    else:
        # Generate random suffix if no sequence provided
        seq_part = "".join(random.choices(string.digits, k=4))

    return f"{prefix}-{date_part}-{seq_part}"


def format_currency(amount: float, currency: str = "Rp") -> str:
    """
    Format a number as Indonesian Rupiah currency.

    Args:
        amount: The amount to format
        currency: Currency symbol (default: Rp)

    Returns:
        Formatted currency string (e.g., 'Rp 1.500.000')
    """
    if amount is None:
        return f"{currency} 0"

    # Format with thousand separators (Indonesian uses dots)
    formatted = f"{amount:,.0f}".replace(",", ".")
    return f"{currency} {formatted}"


def format_date(
    dt: Optional[date | datetime],
    format_str: str = "%d-%m-%Y",
) -> str:
    """
    Format a date or datetime object.

    Args:
        dt: Date or datetime object
        format_str: Output format string

    Returns:
        Formatted date string or empty string if None
    """
    if dt is None:
        return ""
    return dt.strftime(format_str)


def calculate_percentage(value: float, total: float) -> float:
    """
    Calculate percentage safely.

    Args:
        value: The partial value
        total: The total value

    Returns:
        Percentage (0-100) or 0 if total is 0
    """
    if total == 0:
        return 0.0
    return round((value / total) * 100, 2)


def parse_date(date_str: str, format_str: str = "%Y-%m-%d") -> Optional[date]:
    """
    Parse a date string to date object.

    Args:
        date_str: Date string to parse
        format_str: Expected format of the date string

    Returns:
        Date object or None if parsing fails
    """
    try:
        return datetime.strptime(date_str, format_str).date()
    except (ValueError, TypeError):
        return None


def truncate_string(text: str, max_length: int = 50) -> str:
    """
    Truncate a string to a maximum length with ellipsis.

    Args:
        text: String to truncate
        max_length: Maximum length including ellipsis

    Returns:
        Truncated string with '...' if needed
    """
    if text is None:
        return ""
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."
