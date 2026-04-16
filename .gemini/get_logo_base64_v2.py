import base64
import os

file_path = r'c:\laragon\www\tpm\frontend\assets\logo_tpm.png'
with open(file_path, "rb") as image_file:
    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    # Write to a file instead of printing
    with open(r'c:\laragon\www\tpm\.gemini\logo_base64.txt', "w") as out:
        out.write(encoded_string)
