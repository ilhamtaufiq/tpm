Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Start TPM local development services on Windows without Docker.
# Backend and frontend are launched together, and both are stopped on Ctrl+C.

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RepoRoot 'backend'
$FrontendDir = Join-Path $RepoRoot 'frontend'
$BackendActivate = Join-Path $BackendDir 'venv\Scripts\Activate.ps1'
$FrontendNodeModules = Join-Path $FrontendDir 'node_modules'

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

if (-not (Test-Path -LiteralPath $BackendActivate)) {
    throw "Backend virtual environment tidak ditemukan di: $BackendActivate"
}

if (-not (Test-Path -LiteralPath $FrontendNodeModules)) {
    throw "Dependency frontend tidak ditemukan di: $FrontendNodeModules`nJalankan npm install di folder frontend terlebih dahulu."
}

$backendJob = $null
$frontendJob = $null

try {
    Write-Step 'Menjalankan backend di http://localhost:8000'
    $backendJob = Start-Job -Name 'tpm-backend' -ScriptBlock {
        param($dir)
        Set-Location -LiteralPath $dir
        & '.\venv\Scripts\Activate.ps1'
        uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
    } -ArgumentList $BackendDir

    Write-Step 'Menjalankan frontend web Expo'
    $frontendJob = Start-Job -Name 'tpm-frontend' -ScriptBlock {
        param($dir)
        Set-Location -LiteralPath $dir
        npx expo start --web
    } -ArgumentList $FrontendDir

    Write-Host @'

Local development services sedang berjalan.

Backend:
  http://localhost:8000
  http://localhost:8000/docs

Frontend:
  Expo web dev server sedang dijalankan.

Tekan Ctrl+C untuk menghentikan keduanya.
'@

    while ($true) {
        Receive-Job -Job $backendJob -ErrorAction Continue
        Receive-Job -Job $frontendJob -ErrorAction Continue

        if ($backendJob.State -in @('Failed', 'Stopped', 'Completed')) {
            throw "Backend berhenti dengan status: $($backendJob.State)"
        }

        if ($frontendJob.State -in @('Failed', 'Stopped', 'Completed')) {
            throw "Frontend berhenti dengan status: $($frontendJob.State)"
        }

        Start-Sleep -Milliseconds 500
    }
}
finally {
    Write-Step 'Menghentikan local development services'

    foreach ($job in @($backendJob, $frontendJob)) {
        if ($null -ne $job) {
            Stop-Job -Job $job -ErrorAction SilentlyContinue | Out-Null
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        }
    }
}



