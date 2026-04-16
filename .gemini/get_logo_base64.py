import base64
import os

file_path = r'c:\laragon\www\tpm\frontend\assets\logo_tpm.png'
with open(file_path, "rb") as image_file:
    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    # Print in chunks to avoid issues with long output if any
    print(encoded_string)
