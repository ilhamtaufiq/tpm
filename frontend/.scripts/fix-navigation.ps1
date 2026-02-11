# Script to replace useNavigation with useRouter in all files
# This fixes the navigation context error

$files = @(
    "app\sdm\slip-gaji.tsx",
    "app\sdm\kasbon.tsx",
    "app\sdm\karyawan.tsx",
    "app\master-data\supplier.tsx",
    "app\master-data\sparepart.tsx",
    "app\master-data\jasa-servis.tsx",
    "app\master-data\customer.tsx",
    "app\laporan\stock-sparepart.tsx",
    "app\laporan\penjualan-bengkel.tsx",
    "app\laporan\penjualan-mobil.tsx",
    "app\laporan\pembelian-sparepart.tsx",
    "app\laporan\pembelian-mobil.tsx",
    "app\laporan\jasa-angkut.tsx",
    "app\jasa-angkut\supir.tsx",
    "app\bengkel\purchase\index.tsx",
    "app\bengkel\inventory\index.tsx",
    "app\bengkel\expenses\index.tsx"
)

foreach ($file in $files) {
    $filePath = Join-Path $PSScriptRoot "..\$file"
    
    if (Test-Path $filePath) {
        Write-Host "Processing $file..."
        
        $content = Get-Content $filePath -Raw
        
        # Remove useNavigation import
        $content = $content -replace ', useNavigation', ''
        $content = $content -replace 'useNavigation, ', ''
        $content = $content -replace 'import \{ useNavigation \} from \x27expo-router\x27;?\r?\n?', ''
        
        # Remove navigation variable
        $content = $content -replace '\s+const navigation = useNavigation\(\);?\r?\n?', ''
        
        # Replace navigation.canGoBack() with router.canGoBack()
        $content = $content -replace 'navigation\.canGoBack\(\)', 'router.canGoBack()'
        
        # Replace navigation.goBack() with router.back()
        $content = $content -replace 'navigation\.goBack\(\)', 'router.back()'
        
        # Save the file
        $content | Set-Content $filePath -NoNewline
        
        Write-Host "Fixed $file" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "All files processed!" -ForegroundColor Cyan
