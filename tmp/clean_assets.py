from PIL import Image
import os

def clean_png(file_path):
    if not os.path.exists(file_path):
        print(f"Skipping: {file_path} (Not found)")
        return
    try:
        img = Image.open(file_path)
        # Convert to RGBA to ensure consistency and strip any weird bits
        img = img.convert("RGBA")
        # Save without any metadata
        img.save(file_path, "PNG", optimize=True)
        print(f"Successfully cleaned: {file_path}")
    except Exception as e:
        print(f"Error cleaning {file_path}: {e}")

assets_dir = r"c:\laragon\www\tpm\frontend\assets"
files_to_clean = [
    "logo-tpm.png",
    "icon.png",
    "adaptive-icon.png",
    "splash-icon.png",
    "favicon2.png"
]

for f in files_to_clean:
    clean_png(os.path.join(assets_dir, f))
