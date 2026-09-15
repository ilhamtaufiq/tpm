"""Path-traversal guard on the backup filename.

Run: python -m pytest backend/tests/test_backup_filename_guard.py
"""
import pytest
from fastapi import HTTPException

from app.api.v1.backup import _safe_filename


@pytest.mark.parametrize(
    "evil",
    [
        r"..\..\app\config.py",
        r"..\TPM_BACKUP_x.zip",
        "../../etc/passwd",
        r"sub\TPM_BACKUP_x.zip",
        "sub/TPM_BACKUP_x.zip",
        ".hidden.zip",
        "notazip.sql",
        "",
    ],
)
def test_rejects_traversal_and_non_zip(evil):
    with pytest.raises(HTTPException) as exc:
        _safe_filename(evil)
    assert exc.value.status_code == 400


@pytest.mark.parametrize(
    "good",
    ["TPM_BACKUP_20260914_163520.zip", "TPM_BACKUP_20260914_111953 140926 11.17.zip"],
)
def test_accepts_plain_backup_names(good):
    assert _safe_filename(good) == good
