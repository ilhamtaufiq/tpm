import os
import subprocess
import difflib
import sys
from datetime import datetime

# ==========================================
# CONFIGURATION
# ==========================================

# LOCAL (Laragon)
LOCAL_DB = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "",
    "name": "tpm_db"  # We found this in your backend/.env
}

# VPS (Linux)
VPS_DB = {
    "host": "localhost",   # Connection target from VPS perspective
    "port": 3306,          # Remote MySQL port
    "user": "tpm",
    "password": "Cianjur22!",
    "name": "tpm"
}

# SSH SETTINGS (Automated Tunnel)
SSH_CONFIG = {
    "host": "100.110.202.102",
    "user": "olobor",
    "password": "Cianjur22!", # SSH Password
    "local_bind_port": 3307    # Local port to bind the tunnel
}

# ==========================================
# CORE LOGIC
# ==========================================

def get_schema(db_config, filename):
    print(f"[*] Extracting schema from {db_config['name']} ({db_config['host']}:{db_config['port']})...")
    
    # Construct mysqldump command
    # --no-data: Only structure
    # --skip-comments: Cleaner diff
    # --compact: Even cleaner
    # --skip-add-drop-table: Match-only
    cmd = [
        "mysqldump",
        f"-h{db_config['host']}",
        f"-P{db_config['port']}",
        f"-u{db_config['user']}",
        f"--password={db_config['password']}" if db_config['password'] else "",
        "--no-data",
        "--skip-comments",
        "--skip-dump-date",
        "--skip-set-charset",
        db_config['name']
    ]
    
    # Remove empty password arg if needed
    cmd = [c for c in cmd if c]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        # Post-processing: Remove AUTO_INCREMENT values to avoid false positives
        lines = result.stdout.splitlines()
        processed_lines = []
        for line in lines:
            if "AUTO_INCREMENT=" in line:
                # Remove AUTO_INCREMENT=X
                import re
                line = re.sub(r'AUTO_INCREMENT=\d+', '', line)
            processed_lines.append(line)
            
        with open(filename, "w") as f:
            f.write("\n".join(processed_lines))
        return True
    except subprocess.CalledProcessError as e:
        print(f"[!] Error dumping {db_config['name']}: {e.stderr}")
        return False

def compare_files(file1, file2):
    print(f"[*] Comparing {file1} and {file2}...")
    with open(file1, 'r') as f1, open(file2, 'r') as f2:
        diff = difflib.unified_diff(
            f1.readlines(), 
            f2.readlines(), 
            fromfile='Local System', 
            tofile='VPS System',
            n=3
        )
        
    diff_text = "".join(diff)
    if not diff_text:
        print("\n[SUCCESS] Structure matches perfectly!")
    else:
        print("\n[DIFFERENCE FOUND]")
        print("-" * 50)
        print(diff_text)
        print("-" * 50)
        
        report_file = f"diff_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(report_file, "w") as f:
            f.write(diff_text)
        print(f"[*] Full report saved to: {report_file}")

if __name__ == "__main__":
    import shutil
    
    # Check if mysqldump is available
    if not shutil.which("mysqldump"):
        print("[!] mysqldump not found in PATH.")
        print("Please ensure Laragon's MySQL bin folder (e.g. C:\\laragon\\bin\\mysql\\...) is in your Windows environment variables.")
        sys.exit(1)

    local_file = "schema_local.sql"
    vps_file = "schema_vps.sql"

    # Step 1: Dump Local (Windows Laragon)
    print("\n[*] Starting Local Dump...")
    if not get_schema(LOCAL_DB, local_file):
        sys.exit(1)

    # Step 2: Handle Tunnel & Dump VPS (Linux)
    print("\n[*] Attempting to connect to VPS via SSH Tunnel...")
    
    try:
        from sshtunnel import SSHTunnelForwarder
        
        # Use SSHTunnelForwarder for automated tunnel
        with SSHTunnelForwarder(
            (SSH_CONFIG["host"], 22),
            ssh_username=SSH_CONFIG["user"],
            ssh_password=SSH_CONFIG["password"],
            remote_bind_address=('127.0.0.1', 3306),
            local_bind_address=('127.0.0.1', SSH_CONFIG["local_bind_port"])
        ) as tunnel:
            print(f"[*] Tunnel established on port {SSH_CONFIG['local_bind_port']}")
            
            # Temporary override VPS_DB for tunnel connection
            TUNNELED_VPS = VPS_DB.copy()
            TUNNELED_VPS["host"] = "127.0.0.1"
            TUNNELED_VPS["port"] = SSH_CONFIG["local_bind_port"]
            
            if not get_schema(TUNNELED_VPS, vps_file):
                print("[!] Failed to dump schema via Tunnel.")
                sys.exit(1)
                
    except ImportError:
        print("[!] 'sshtunnel' library not found. Falling back to MANUAL mode.")
        print("    Run: 'pip install sshtunnel paramiko' to automate this.")
        print(f"\n[MANUAL] Open a terminal and run: ssh -L {SSH_CONFIG['local_bind_port']}:localhost:3306 {SSH_CONFIG['user']}@{SSH_CONFIG['host']}")
        input("    Press Enter AFTER you have opened the tunnel manually...")
        
        MANUAL_VPS = VPS_DB.copy()
        MANUAL_VPS["host"] = "127.0.0.1"
        MANUAL_VPS["port"] = SSH_CONFIG["local_bind_port"]
        if not get_schema(MANUAL_VPS, vps_file):
            sys.exit(1)
    except Exception as e:
        print(f"[ERROR] SSH Tunnel failed: {e}")
        sys.exit(1)

    # Step 3: Compare
    compare_files(local_file, vps_file)
    
    print("\n[Done] You can now review the diff_report file.")
