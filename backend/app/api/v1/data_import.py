"""Multi-sheet Excel data import (Admin only)."""
from datetime import datetime

from fastapi import APIRouter, File, UploadFile, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.deps import DBSession, AdminUser
from app.services.data_import_service import DataImportService

router = APIRouter(prefix="/data-import", tags=["Data Import"])

MAX_BYTES = 8 * 1024 * 1024  # 8 MB


def _read_xlsx(file: UploadFile) -> bytes:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File harus berformat Excel (.xlsx)",
        )
    contents = file.file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File terlalu besar (maks 8MB)",
        )
    if not contents:
        raise HTTPException(status_code=400, detail="File kosong")
    return contents


@router.get("/template")
def download_template(
    db: DBSession,
    current_user: AdminUser,
):
    """Download multi-sheet Excel template for existing-data import."""
    service = DataImportService(db)
    output = service.generate_template()
    filename = f"TPM_IMPORT_TEMPLATE_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/preview")
def preview_import(
    db: DBSession,
    current_user: AdminUser,
    file: UploadFile = File(...),
):
    """Dry-run import — no database commit."""
    contents = _read_xlsx(file)
    service = DataImportService(db)
    return service.preview(contents, user_id=current_user.id)


@router.post("/commit")
def commit_import(
    db: DBSession,
    current_user: AdminUser,
    file: UploadFile = File(...),
):
    """Commit import in a single DB transaction (all-or-nothing)."""
    contents = _read_xlsx(file)
    service = DataImportService(db)
    return service.commit(contents, user_id=current_user.id)
