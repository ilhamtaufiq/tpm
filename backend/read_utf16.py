import sys

file_path = r'c:\laragon\www\tpm\backend\show_create.txt'
try:
    with open(file_path, 'r', encoding='utf-16le') as f:
        content = f.read()
    print(content)
except Exception as e:
    print(e)
