# Ganti token Stockbit di server live (jni-server) dari laptop Windows, lewat SSH.
# Token diketik tersembunyi, diperiksa dulu di laptop (bentuk JWT dan masa berlaku), lalu dikirim lewat stdin SSH,
# jadi tidak muncul di layar, di riwayat shell, maupun di daftar proses. Symlink .stockbit-token di server tetap
# utuh (yang ditulis berkas tujuannya). Setelah itu /api/status live dicek untuk memastikan token baru terbaca.
#
# Pemakaian (PowerShell, dari folder repo):
#   .\deploy\ganti-token.ps1                 # token akses (header Authorization: Bearer eyJ...)
#   .\deploy\ganti-token.ps1 -Refresh        # refresh token (respons login/refresh); diperpanjang otomatis
#   .\deploy\ganti-token.ps1 -Server nama-host-ssh-lain
# Bila diblokir ExecutionPolicy:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\ganti-token.ps1
param(
  [string]$Server = 'jni-server',
  [switch]$Refresh,
  [string]$Folder = '~/radar-cangkang/website',
  [string]$Live = 'https://saham.aseprudal.web.id'
)
$ErrorActionPreference = 'Stop'

# Klaim JWT (bagian tengah, base64url) sebagai objek; $null bila bukan JWT.
function Get-KlaimJwt([string]$t) {
  $p = $t.Split('.')
  if ($p.Count -ne 3 -or -not $t.StartsWith('eyJ')) { return $null }
  $b = $p[1].Replace('-', '+').Replace('_', '/')
  switch ($b.Length % 4) { 2 { $b += '==' } 3 { $b += '=' } }
  try { return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b)) | ConvertFrom-Json } catch { return $null }
}
function Get-WaktuLokal([long]$exp) { ([DateTimeOffset]::FromUnixTimeSeconds($exp)).LocalDateTime.ToString('dd-MM-yyyy HH:mm') }

$jenis = if ($Refresh) { 'refresh token' } else { 'token akses' }
$berkas = if ($Refresh) { '.stockbit-refresh' } else { '.stockbit-token' }
$aman = Read-Host "Tempel $jenis Stockbit (tidak tampil di layar)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($aman)
try { $tok = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
$tok = ($tok.Trim() -replace '^(?i)bearer\s+', '')

$klaim = Get-KlaimJwt $tok
if (-not $klaim) { Write-Host "Bukan $jenis yang valid: harus diawali eyJ dan terdiri dari tiga bagian dipisah titik." -ForegroundColor Red; exit 1 }
$sekarang = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
if ($klaim.exp) {
  if ([long]$klaim.exp -le $sekarang) { Write-Host "$jenis ini sudah kedaluwarsa sejak $(Get-WaktuLokal $klaim.exp)." -ForegroundColor Red; exit 1 }
  Write-Host "$jenis berlaku sampai $(Get-WaktuLokal $klaim.exp)."
} elseif (-not $Refresh) { Write-Host 'Token akses tanpa masa berlaku (exp); bukan token Stockbit yang benar.' -ForegroundColor Red; exit 1 }

# Tulis ke berkas sementara di folder tujuan lalu ganti (atomik), izin 600. readlink -f mengikuti symlink.
$perintah = "set -e; f=`$(readlink -f $Folder/$berkas 2>/dev/null || echo $Folder/$berkas); umask 077; " +
            "head -n 1 > `"`$f.baru`"; mv `"`$f.baru`" `"`$f`"; chmod 600 `"`$f`"; echo ok"
Write-Host "Mengirim ke $Server ..."
$hasil = $tok | ssh $Server $perintah
$tok = $null
if ($LASTEXITCODE -ne 0 -or ($hasil | Select-Object -Last 1) -ne 'ok') { Write-Host "Gagal menulis di $Server (kode $LASTEXITCODE)." -ForegroundColor Red; exit 1 }
Write-Host "Tersimpan di $Server`:$Folder/$berkas." -ForegroundColor Green

# Cek server live (tanpa membuka isi token: hanya masa berlaku dan pesan watcher).
try {
  Start-Sleep -Seconds 2
  $st = Invoke-RestMethod "$Live/api/status" -TimeoutSec 20
  if ($Refresh) {
    Write-Host 'Watcher bawaan memakai refresh token ini dalam 15 menit bila token akses tinggal < 2 jam atau sudah habis.'
    Write-Host "Status watcher sekarang: $($st.watcher.bawaan.pesan)"
  } elseif ($st.tokenExp -and [long]$st.tokenExp -eq [long]$klaim.exp) {
    Write-Host "Live sudah memakai token baru, berlaku sampai $(Get-WaktuLokal $st.tokenExp)." -ForegroundColor Green
  } else {
    Write-Host "Live belum menunjukkan token baru (tokenExp $($st.tokenExp)). Cek $Live/api/status sebentar lagi." -ForegroundColor Yellow
  }
} catch { Write-Host "Token tersimpan, tetapi $Live/api/status tidak bisa dicek: $($_.Exception.Message)" -ForegroundColor Yellow }
