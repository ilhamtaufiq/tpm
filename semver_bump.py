import json
import re
import subprocess
import os

# Configuration: Relative to project root
FRONTEND_PJ = "frontend/package.json"
BACKEND_CFG = "backend/app/config.py"

def get_current_version():
    """Read version from frontend/package.json as the source of truth."""
    if not os.path.exists(FRONTEND_PJ):
        return "0.0.0"
    with open(FRONTEND_PJ, 'r') as f:
        data = json.load(f)
        return data.get('version', '0.0.0')

def get_bump_type():
    """Analyze git commits since last tag for Conventional Commits."""
    try:
        # Get the name of the latest tag
        last_tag_cmd = subprocess.run(['git', 'describe', '--tags', '--abbrev=0'], capture_output=True, text=True)
        last_tag = last_tag_cmd.stdout.strip()
        
        if not last_tag:
            # If no tags, check initial commit to today
            git_log_cmd = subprocess.run(['git', 'log', '--pretty=format:%s'], capture_output=True, text=True)
        else:
            # Get commits since last tag
            git_log_cmd = subprocess.run(['git', 'log', f'{last_tag}..HEAD', '--pretty=format:%s'], capture_output=True, text=True)
            
        commits = git_log_cmd.stdout.lower()
        
        # Priority: Major > Minor > Patch
        if "breaking change" in commits or "!" in commits: # ! in commit like feat!:
            return "major"
        if "feat:" in commits:
            return "minor"
        if "fix:" in commits:
            return "patch"
        return None
    except Exception as e:
        print(f"Git interaction failed: {e}")
        return None

def bump_version(current_v, bump_type):
    """Increment version parts."""
    try:
        parts = current_v.split('.')
        major = int(parts[0])
        minor = int(parts[1])
        patch = int(parts[2])
    except (ValueError, IndexError):
        major, minor, patch = 0, 0, 0

    if bump_type == "major":
        major += 1
        minor = 0
        patch = 0
    elif bump_type == "minor":
        minor += 1
        patch = 0
    elif bump_type == "patch":
        patch += 1
    
    return f"{major}.{minor}.{patch}"

def update_version_files(new_version):
    """Write the new version to frontend and backend config files."""
    # 1. Update package.json
    if os.path.exists(FRONTEND_PJ):
        with open(FRONTEND_PJ, 'r') as f:
            data = json.load(f)
        data['version'] = new_version
        with open(FRONTEND_PJ, 'w') as f:
            json.dump(data, f, indent=2)
            f.write('\n') # Ensure newline at end of file
        print(f"Success: Updated {FRONTEND_PJ}")

    # 2. Update backend config.py
    if os.path.exists(BACKEND_CFG):
        with open(BACKEND_CFG, 'r') as f:
            content = f.read()
        
        # Regex to find app_version: str = "x.x.x"
        pattern = r'(app_version:\s*str\s*=\s*)(["\']\d+\.\d+\.\d+["\'])'
        replacement = rf'\1"{new_version}"'
        
        new_content = re.sub(pattern, replacement, content)
        
        with open(BACKEND_CFG, 'w') as f:
            f.write(new_content)
        print(f"Success: Updated {BACKEND_CFG}")

def create_git_tag(version):
    """Optionally create a git tag for the new version."""
    try:
        # Check if tag already exists
        check_tag = subprocess.run(['git', 'rev-parse', f'v{version}'], capture_output=True)
        if check_tag.returncode == 0:
            print(f"Tag v{version} already exists locally.")
            return

        subprocess.run(['git', 'tag', '-a', f'v{version}', '-m', f'Release version {version}'], check=True)
        print(f"Success: Created Git Tag v{version}")
        print("Note: Remember to push tags with 'git push --tags'")
    except Exception as e:
        print(f"Failed to create tag: {e}")

if __name__ == "__main__":
    current = get_current_version()
    print(f"Current version: {current}")
    
    bump = get_bump_type()
    
    if not bump:
        print("Automatic Detection Result: No version bump needed (no feat: or fix: commits found).")
        print("Manual Override possible: python semver_bump.py [major|minor|patch]")
        
        # Check for manual override in sys.argv
        import sys
        if len(sys.argv) > 1 and sys.argv[1] in ["major", "minor", "patch"]:
            bump = sys.argv[1]
            print(f"Using manual override: {bump}")
        else:
            sys.exit(0)

    new_v = bump_version(current, bump)
    print(f"Bumping version: {current} -> {new_v} (Type: {bump})")
    
    update_version_files(new_v)
    create_git_tag(new_v)
    print("\nAll files synchronized.")
