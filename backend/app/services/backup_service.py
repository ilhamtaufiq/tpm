import os
import subprocess
import shutil
import time
from datetime import datetime
from typing import List, Optional
import zipfile
from app.config import settings

class BackupService:
    def __init__(self):
        self.backup_dir = os.path.join(settings.base_dir, "backups")
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir)

    def get_backups(self) -> List[dict]:
        """List all available backup files."""
        files = []
        for filename in os.listdir(self.backup_dir):
            if filename.endswith(".zip"):
                file_path = os.path.join(self.backup_dir, filename)
                stats = os.stat(file_path)
                files.append({
                    "filename": filename,
                    "size": stats.st_size,
                    "created_at": datetime.fromtimestamp(stats.st_ctime).isoformat(),
                    "path": file_path
                })
        # Sort by creation time descending
        return sorted(files, key=lambda x: x["created_at"], reverse=True)

    def create_backup(self) -> str:
        """Create a full backup (DB + Uploads)."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        temp_dir = os.path.join(self.backup_dir, f"temp_{timestamp}")
        os.makedirs(temp_dir, exist_ok=True)

        try:
            # 1. Backup Database
            sql_file = os.path.join(temp_dir, f"{settings.db_name}_{timestamp}.sql")
            
            # Construct mysqldump command
            # Using --no-tablespaces to avoid permission issues if not superuser
            dump_cmd = [
                "mysqldump",
                f"-h{settings.db_host}",
                f"-P{settings.db_port}",
                f"-u{settings.db_user}",
                f"--password={settings.db_password}" if settings.db_password else "",
                "--no-tablespaces",
                settings.db_name
            ]
            
            # Filter out empty password part
            dump_cmd = [part for part in dump_cmd if part]
            
            with open(sql_file, "w") as f:
                subprocess.run(dump_cmd, stdout=f, check=True)

            # 2. Copy Uploads folder
            uploads_dest = os.path.join(temp_dir, "uploads")
            if os.path.exists(settings.upload_full_path):
                shutil.copytree(settings.upload_full_path, uploads_dest)

            # 3. Create ZIP archive
            zip_filename = f"TPM_BACKUP_{timestamp}.zip"
            zip_path = os.path.join(self.backup_dir, zip_filename)
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_abs_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_abs_path, temp_dir)
                        zipf.write(file_abs_path, arcname)

            return zip_filename

        finally:
            # Clean up temp directory
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

    def delete_backup(self, filename: str) -> bool:
        """Delete a backup file."""
        file_path = os.path.join(self.backup_dir, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False

    def restore_backup(self, filename: str) -> bool:
        """Restore a full backup."""
        zip_path = os.path.join(self.backup_dir, filename)
        if not os.path.exists(zip_path):
            return False

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        temp_dir = os.path.join(self.backup_dir, f"restore_temp_{timestamp}")
        os.makedirs(temp_dir, exist_ok=True)

        try:
            # 1. Extract ZIP
            with zipfile.ZipFile(zip_path, 'r') as zipf:
                zipf.extractall(temp_dir)

            # 2. Restore Database
            sql_files = [f for f in os.listdir(temp_dir) if f.endswith(".sql")]
            if sql_files:
                sql_file = os.path.join(temp_dir, sql_files[0])
                
                # Construct mysql command
                restore_cmd = [
                    "mysql",
                    f"-h{settings.db_host}",
                    f"-P{settings.db_port}",
                    f"-u{settings.db_user}",
                    f"--password={settings.db_password}" if settings.db_password else "",
                    settings.db_name
                ]
                restore_cmd = [part for part in restore_cmd if part]
                
                with open(sql_file, "r") as f:
                    subprocess.run(restore_cmd, stdin=f, check=True)

            # 3. Restore Uploads
            uploads_src = os.path.join(temp_dir, "uploads")
            if os.path.exists(uploads_src):
                # We rename current uploads as backup before replacing
                current_uploads = settings.upload_full_path
                if os.path.exists(current_uploads):
                    backup_uploads = f"{current_uploads}_pre_restore_{timestamp}"
                    os.rename(current_uploads, backup_uploads)
                
                shutil.copytree(uploads_src, current_uploads)

            return True

        finally:
            # Clean up temp directory
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

backup_service = BackupService()
