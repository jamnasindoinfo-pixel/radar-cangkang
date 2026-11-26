#!/usr/bin/env bash
# CD lokal radar-cangkang, dijalankan systemd timer di jni-server tiap 2 menit (deploy/radar-deploy.timer).
# Ada commit baru di origin/main → uji di worktree terpisah (tes frontend, tes server, build) → bila lulus,
# perbarui folder live, build, restart, cek kesehatan; cek gagal = kembali otomatis ke versi sebelumnya.
# Setelah hidup: deploy/cek_pasca.py memeriksa halaman utama + JS (kritis) dan isi data penting (peringatan).
# Status terakhir: .ci/status.json (juga tampil di /api/status → "deploy"); riwayat: .ci/deploy.log.
set -euo pipefail

APP=${APP:-$HOME/radar-cangkang}
CI=${CI:-$HOME/radar-cangkang-ci}
SERVICE=${SERVICE:-radar-cangkang}
PORT=${PORT:-8765}
STATE=$APP/.ci
mkdir -p "$STATE"
exec 9>"$STATE/lock"
flock -n 9 || exit 0   # deploy sebelumnya masih berjalan

log() { echo "$(date '+%F %T') $*" | tee -a "$STATE/deploy.log"; }
status() {  # status <commit> <hasil> <pesan>
  python3 -c 'import json,sys,datetime; print(json.dumps({"commit": sys.argv[1], "hasil": sys.argv[2], "pesan": sys.argv[3],
    "waktu": datetime.datetime.now().isoformat(timespec="seconds")}))' "$1" "$2" "$3" > "$STATE/status.json"
}
npm_ci() { npm ci --include=dev --no-audit --no-fund >/dev/null 2>&1; }

cd "$APP"
git fetch -q origin main
NEW=$(git rev-parse origin/main)
CUR=$(git rev-parse HEAD)
[ "$NEW" = "$CUR" ] && exit 0
[ -f "$STATE/failed-$NEW" ] && exit 0   # commit ini sudah gagal; tunggu commit berikutnya
SHORT=$(git rev-parse --short "$NEW")
log "commit baru $SHORT: $(git log -1 --format=%s "$NEW")"
status "$SHORT" "menguji" "tes dan build sedang berjalan"

fail() { touch "$STATE/failed-$NEW"; log "GAGAL $SHORT: $1 (live tetap $(git rev-parse --short HEAD))"; status "$SHORT" "gagal" "$1"; exit 1; }

# 1) Uji di worktree terpisah: folder live tidak tersentuh sampai semua lulus.
[ -e "$CI/.git" ] || git worktree add -q --detach "$CI" "$NEW"
git -C "$CI" checkout -q --detach --force "$NEW"
( cd "$CI/frontend" && npm_ci && npx vitest run >"$STATE/ci-frontend.log" 2>&1 ) || fail "tes frontend gagal (.ci/ci-frontend.log)"
python3 "$CI/website/test_server.py" >"$STATE/ci-server.log" 2>&1 || fail "tes server gagal (.ci/ci-server.log)"
( cd "$CI/frontend" && npm run build >"$STATE/ci-build.log" 2>&1 ) || fail "build gagal (.ci/ci-build.log)"

# 2) Terapkan ke folder live; kembali ke versi lama bila build/restart/cek kesehatan gagal.
git merge -q --ff-only "$NEW" || fail "folder live punya perubahan lokal atau bercabang; tidak bisa fast-forward"
apply() {  # apply <commit-lama-untuk-cek-lockfile>
  if ! git diff --quiet "$1" HEAD -- frontend/package-lock.json; then (cd frontend && npm_ci); fi
  (cd frontend && npm run build >"$STATE/build.log" 2>&1) || return 1
  systemctl --user restart "$SERVICE"
  local hidup=1
  for _ in $(seq 1 20); do
    sleep 1
    curl -sf -o /dev/null "http://127.0.0.1:$PORT/api/status" && { hidup=0; break; }
  done
  [ "$hidup" = 0 ] || return 1
  # Halaman utama/JS tidak termuat = kritis (kode keluar 2) -> kembali ke versi sebelumnya.
  python3 deploy/cek_pasca.py "$PORT" >"$STATE/cek.json" || return 1
}
if apply "$CUR"; then
  PER=$(python3 -c 'import json,sys; print("; ".join(json.load(open(sys.argv[1]))["peringatan"]))' "$STATE/cek.json" 2>/dev/null || true)
  if [ -n "$PER" ]; then
    log "LIVE $SHORT, peringatan: $PER"
    status "$SHORT" "live" "tes, build, dan cek kesehatan lulus; peringatan data: $PER"
  else
    log "LIVE $SHORT"
    status "$SHORT" "live" "tes, build, cek kesehatan, dan cek isi data lulus"
  fi
else
  log "cek gagal setelah deploy $SHORT, kembali ke $(git rev-parse --short "$CUR")"
  git reset -q --keep "$CUR"
  apply "$NEW" || true
  fail "build atau server gagal setelah dipasang; dikembalikan ke versi sebelumnya"
fi
