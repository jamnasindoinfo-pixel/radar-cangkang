#!/usr/bin/env bash
# Pasang kunci Azure Speech untuk narasi video bersuara pria ("Ardi").
# Jalankan di jni-server:  bash ~/radar-cangkang/pasang-suara-azure.sh
# Kunci diketik sendiri (tidak tampil di layar), diuji ke Azure, lalu disimpan di website/.azure-speech
# (izin 600; diabaikan git dan tidak pernah disajikan server). Server membacanya langsung, tanpa restart.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
FILE="$DIR/website/.azure-speech"

echo "Pasang suara pria Azure Speech untuk video Radar Backdoor"
echo "Ambil KEY 1 dan Location/Region di portal.azure.com > Speech service > Keys and Endpoint."
read -rsp "KEY 1 (tidak tampil saat diketik): " KEY; echo
read -rp "Region [southeastasia]: " REGION
REGION="${REGION:-southeastasia}"
[ -n "$KEY" ] || { echo "Kunci kosong, dibatalkan."; exit 1; }

echo "Menguji kunci ke Azure ($REGION)..."
TMP="$(mktemp)"
CODE=$(curl -s -o "$TMP" -w "%{http_code}" -X POST "https://$REGION.tts.speech.microsoft.com/cognitiveservices/v1" \
  -H "Ocp-Apim-Subscription-Key: $KEY" -H "Content-Type: application/ssml+xml" \
  -H "X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3" -H "User-Agent: radar-backdoor" \
  --data "<speak version='1.0' xml:lang='id-ID'><voice name='id-ID-ArdiNeural'>Tes suara.</voice></speak>" || echo 000)
SIZE=$(wc -c < "$TMP"); rm -f "$TMP"
if [ "$CODE" != "200" ] || [ "$SIZE" -lt 500 ]; then
  echo "Gagal (HTTP $CODE). Periksa KEY 1 dan region, lalu jalankan ulang skrip ini."
  exit 1
fi

umask 077
printf '%s\n%s\n' "$KEY" "$REGION" > "$FILE"
chmod 600 "$FILE"
unset KEY
echo "Berhasil: kunci tersimpan di $FILE (izin 600)."
echo "Cek status: curl -s http://127.0.0.1:8765/api/status | grep -o '\"tts\": [a-z]*'"
