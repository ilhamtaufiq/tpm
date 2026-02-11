import os

file_path = r'c:\laragon\www\tpm\frontend\app\laporan\pembelian-sparepart.tsx'

print(f"Checking file: {file_path}")

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    for i, line in enumerate(lines):
        stripped = line.strip()
        # Exact match
        if stripped == '.':
            print(f"FOUND STRAY DOT (exact) on line {i+1}: '{line.strip()}'")
        
        # Check for >. or .<
        if '>.' in line:
            print(f"FOUND DOT AFTER TAG on line {i+1}: '{line.strip()}'")
        if '.<' in line:
            print(f"FOUND DOT BEFORE TAG on line {i+1}: '{line.strip()}'")
            
        # Check for . at end of line if it's not code
        # heuristic: if line ends with . and doesn't look like code (no ;)
        if line.rstrip().endswith('.') and not line.strip().startswith('//') and not line.strip().startswith('*'):
            # Ignore imports or console.logs or comments
            if 'import ' not in line and 'console.' not in line:
                 # Check if it's inside a valid text string or comment
                 pass 

        # Check for standalone dot in JSX
        # This is hard to regex perfectly but let's look for " . " patterns
        if ' . ' in line:
             print(f"FOUND SUSPICIOUS DOT WITH SPACES on line {i+1}: '{line.strip()}'")

except FileNotFoundError:
    print("File not found.")
