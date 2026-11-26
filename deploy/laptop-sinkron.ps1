# Pembaruan kode otomatis di laptop Windows, pasangan CD jni-server (deploy/deploy.sh).
# Ada commit baru di origin/main -> fast-forward main (hanya bila sedang di main dan tanpa perubahan lokal),
# npm ci bila lockfile berubah, build frontend, lalu restart server lokal bila kode server (website/*.py) berubah.
# Data dan token tidak disentuh (itu tugas sinkron di server.py). Riwayat: website\.laptop-sinkron.log.
#
# Pasang sekali (Command Prompt/PowerShell), berjalan tiap 10 menit:
#   schtasks /Create /SC MINUTE /MO 10 /TN "Radar Sinkron Kode" /TR "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File D:\radar-cangkang-baru\deploy\laptop-sinkron.ps1"
# Hapus: schtasks /Delete /TN "Radar Sinkron Kode" /F
param([int]$Port = 8765)

$Repo = Split-Path -Parent $PSScriptRoot
$Log = Join-Path $Repo 'website\.laptop-sinkron.log'
function Tulis([string]$m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" | Out-File -FilePath $Log -Append -Encoding utf8 }

Set-Location $Repo
git fetch -q origin main 2>$null
if ($LASTEXITCODE -ne 0) { Tulis 'fetch gagal (offline?)'; exit 1 }
$lama = (git rev-parse HEAD).Trim()
$baru = (git rev-parse origin/main).Trim()
if ($lama -eq $baru) { exit 0 }
$cabang = (git rev-parse --abbrev-ref HEAD).Trim()
if ($cabang -ne 'main') { Tulis "dilewati: cabang aktif $cabang, bukan main"; exit 0 }
if (git status --porcelain --untracked-files=no) { Tulis 'dilewati: ada perubahan lokal yang belum di-commit'; exit 0 }
git merge -q --ff-only origin/main
if ($LASTEXITCODE -ne 0) { Tulis 'dilewati: main lokal bercabang dari origin/main, tidak bisa fast-forward'; exit 1 }
$ubah = @(git diff --name-only $lama HEAD)

Push-Location (Join-Path $Repo 'frontend')
if ($ubah -contains 'frontend/package-lock.json') { & npm.cmd ci --no-audit --no-fund | Out-Null }
& npm.cmd run build | Out-Null
$buildOk = ($LASTEXITCODE -eq 0)
Pop-Location
if (-not $buildOk) { Tulis "build gagal pada $($baru.Substring(0, 7)); tampilan lama tetap dipakai"; exit 1 }

# Restart server lokal yang sedang berjalan di port ini agar kode server baru terbaca.
if ($ubah | Where-Object { $_ -like 'website/*.py' }) {
  $proses = Get-CimInstance Win32_Process -Filter "Name like 'python%'" |
    Where-Object { $_.CommandLine -match 'server\.py' -and $_.CommandLine -match "--port\s+$Port\b" }
  if ($proses) {
    $proses | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    $env:PYTHONUTF8 = '1'
    Start-Process -FilePath 'python' -ArgumentList @('website\server.py', '--port', "$Port") -WorkingDirectory $Repo `
      -WindowStyle Hidden -RedirectStandardError (Join-Path $Repo 'website\.server-err.log') `
      -RedirectStandardOutput (Join-Path $Repo 'website\.server.log')
    Tulis 'server lokal direstart'
  }
}
Tulis "diperbarui ke $($baru.Substring(0, 7)): $(git log -1 --format=%s)"
