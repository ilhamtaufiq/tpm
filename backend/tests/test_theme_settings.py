"""Validasi warna tema perusahaan (pengaturan server)."""
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.schemas.settings import ThemeSetting  # noqa: E402

WARNA_VALID = {
    "primary": "#023c69",
    "secondary": "#64748B",
    "background": "#F4F6F8",
    "surface": "#FFFFFF",
    "text": "#111827",
    "textGray": "#6B7280",
}


def test_warna_hex_diterima_dan_dinormalkan():
    tema = ThemeSetting(**WARNA_VALID)
    assert tema.primary == "#023C69"


@pytest.mark.parametrize("nilai", ["blue", "#FFF", "#GG0000", "023C69"])
def test_warna_bukan_hex_ditolak(nilai):
    with pytest.raises(ValidationError):
        ThemeSetting(**{**WARNA_VALID, "primary": nilai})
