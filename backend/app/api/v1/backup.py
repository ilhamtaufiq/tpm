from typing import List, Any
from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse
import os
import shutil
from datetime import datetime
from app.api.deps import CurrentUser, DBSession
from app.services.backup_service import backup_service
from app.utils.constants import UserRole
from pydantic import BaseModel

router = APIRouter(prefix="/backup", tags=["System Backup"])

class BackupResponse(BaseModel):
    filename: str
    size: int
    created_at: str

class RestoreRequest(BaseModel):
    password: str

@router.get("/list", response_model=List[BackupResponse])
def list_backups(current_user: CurrentUser):
    """List all available backups on the server."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Administrator yang dapat mengakses daftar backup"
        )
    return backup_service.get_backups()

@router.post("/create", response_model=BackupResponse)
def create_backup(current_user: CurrentUser, db: DBSession):
    """Trigger a new full backup."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Administrator yang dapat membuat backup"
        )
    
    # Close session early before slow shell operations
    db.close()
    
    try:
        filename = backup_service.create_backup()
        backups = backup_service.get_backups()
        # Find the newly created backup in the list
        new_backup = next((b for b in backups if b["filename"] == filename), None)
        if not new_backup:
            raise HTTPException(status_code=500, detail="Gagal mengambil info backup yang baru dibuat")
        return new_backup
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membuat backup: {str(e)}")

@router.get("/download/{filename}")
def download_backup(filename: str, current_user: CurrentUser):
    """Download a specific backup file."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Administrator yang dapat men-download backup"
        )
    
    file_path = os.path.join(backup_service.backup_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File backup tidak ditemukan")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/zip'
    )

@router.delete("/{filename}")
def delete_backup(filename: str, current_user: CurrentUser):
    """Delete a backup file from binary/server."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Administrator yang dapat menghapus backup"
        )
    
    if backup_service.delete_backup(filename):
        return {"message": f"Backup {filename} berhasil dihapus"}
    else:
        raise HTTPException(status_code=404, detail="File backup tidak ditemukan")

@router.post("/restore/{filename}")
def restore_backup(
    filename: str, 
    request: RestoreRequest,
    current_user: CurrentUser,
    db: DBSession
):
    """Restore the system from a backup file."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Administrator yang dapat melakukan restore data"
        )
    
    # Verify Admin Password
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # We need to get the user from DB to get the latest hashed password
    from app.models.user import User
    user = db.query(User).filter(User.id == current_user.id).first()
    
    if not user or not pwd_context.verify(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password verifikasi salah"
        )
    
    # Close session early to return connection to pool while restoring
    db.close()
    
    try:
        if backup_service.restore_backup(filename):
            return {"message": "Sistem berhasil direstore. Silakan login kembali jika diperlukan."}
        else:
            raise HTTPException(status_code=404, detail="File backup tidak ditemukan")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal melakukan restore: {str(e)}")

@router.post("/upload", response_model=BackupResponse)
def upload_backup(
    current_user: CurrentUser,
    file: UploadFile = File(...)
):
    """Upload a backup ZIP file to the server."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Administrator yang dapat mengunggah backup"
        )
    
    if not file.filename.endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hanya file .zip yang diizinkan"
        )
    
    file_path = os.path.join(backup_service.backup_dir, file.filename)
    
    # Save the file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan file: {str(e)}")
    
    # Return info about the uploaded file
    stats = os.stat(file_path)
    return {
        "filename": file.filename,
        "size": stats.st_size,
        "created_at": datetime.fromtimestamp(stats.st_ctime).isoformat()
    }
