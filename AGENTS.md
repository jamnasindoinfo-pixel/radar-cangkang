# AGENTS.md: aturan kerja Radar Backdoor

Panduan untuk siapa pun yang mengubah repo ini, manusia maupun agen AI (Claude Code, Codex, Cursor, dan lainnya).
Baca sampai habis sebelum commit. Konteks produk ada di `PRODUCT.md`, bahasa desain di `DESIGN.md`, dan cara
menjalankan di `README.md`.

## Produk singkat

Radar emiten BEI calon backdoor listing untuk tim kecil. Frontend Vue 3 (`frontend/`) dibangun ke `website/dist/`.
Backend Python stdlib (`website/server.py`) mem-proxy Stockbit dan menyimpan data tim di SQLite.
Versi live: https://saham.aseprudal.web.id (publik, hanya baca), dijalankan di `jni-server`.

## Alur kerja: dari commit sampai live

1. Buat branch dari `main` (`feat/…`, `fix/…`, `chore/…`). Jangan push langsung ke `main`.
2. Uji di komputer sendiri sebelum push:
   ```bash
   python3 website/test_server.py          # tes server
   cd frontend && npx vitest run           # tes frontend
   cd frontend && npm run build            # build harus berhasil
   ```
3. Push branch, buka PR ke `main`, lalu merge setelah tes lulus.
4. **Deploy otomatis (CD lokal).** jni-server mengecek `origin/main` tiap 2 menit (`deploy/deploy.sh` lewat
   systemd timer `radar-deploy.timer`). Kalau ada commit baru, prosesnya:
   - tes frontend, tes server, dan build dijalankan di worktree terpisah (`~/radar-cangkang-ci`);
   - bila semua lulus: folder live di-fast-forward, `npm ci` kalau lockfile berubah, build, restart, cek kesehatan;
   - kalau gagal sebelum dipasang, versi live tidak tersentuh. Kalau gagal setelah dipasang, otomatis kembali ke versi
     sebelumnya. Commit yang gagal tidak dicoba ulang; perbaiki dengan commit baru.
5. **Cek hasil deploy.** Buka https://saham.aseprudal.web.id/api/status, lalu lihat field `deploy`
   (`commit`, `hasil`: `menguji` / `live` / `gagal`, `pesan`, `waktu`). Biasanya live dalam 2–4 menit setelah merge.

Pesan commit dalam bahasa Indonesia dengan awalan konvensional (`feat(…)`, `fix(…)`, `chore(…)`, `docs(…)`).
Satu PR untuk satu tujuan. Jelaskan di badan PR apa yang berubah dan bagaimana mengujinya.

## Operasi server (jni-server)

| Hal | Perintah |
|---|---|
| Status aplikasi | `systemctl --user status radar-cangkang` |
| Log aplikasi | `journalctl --user -u radar-cangkang -n 100` |
| Status / log CD | `cat ~/radar-cangkang/.ci/status.json`, `tail ~/radar-cangkang/.ci/deploy.log` |
| Log tes yang gagal | `~/radar-cangkang/.ci/ci-frontend.log`, `ci-server.log`, `ci-build.log` |
| Jalankan CD sekarang | `systemctl --user start radar-deploy.service` |
| Hentikan CD sementara | `systemctl --user stop radar-deploy.timer` (aktifkan lagi: `start`) |
| Pasang ulang unit CD | `cp deploy/radar-deploy.{service,timer} ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable --now radar-deploy.timer` |
| Sinkron dengan laptop | status: `curl -s localhost:8765/api/status` → `sinkron`; panduan pasang di README (Tailscale, `--lan`, `.sinkron-kunci`) |

Jangan mengedit file langsung di `~/radar-cangkang` di server. CD hanya bisa fast-forward, jadi perubahan lokal
di sana menghentikan deploy. Semua perubahan lewat git.

## Rahasia: jangan pernah di-commit atau disajikan

- `website/.stockbit-token`, `.stockbit-refresh` (token Stockbit; `.stockbit-token` di server adalah symlink).
- `website/.tsa-*` (token/refresh token tradersaham, cache token, dan cadangan kredensial apa pun).
- `website/.radar.sqlite*` (data tim) dan `website/.cache.sqlite*`.
- Server sudah menolak menyajikan dotfile, `*.py`, `stockbit.config.json`, dan `tsa-*.json` (404). Jangan longgarkan
  aturan itu tanpa alasan kuat. Bila menambah berkas rahasia baru, tambahkan juga ke `.gitignore`.
- `website/.sinkron-kunci` dan `.sinkron-peer` (sinkron antarserver) rahasia. Endpoint `/api/sinkron/*` hanya untuk
  jaringan pribadi (Tailscale/LAN) berkunci dan selalu menolak permintaan lewat domain publik; jangan dibuka ke publik.
- Token tradersaham memakai pola bearer seperti Stockbit (`website/.tsa-token` atau `website/.tsa-refresh`). Jangan
  menyimpan email/password di repo atau di server.

## Data dan riset

- Jangan mengarang emiten, angka, nama, atau sinyal. Setiap klaim punya sumber dan tanggal; yang belum terverifikasi
  ditandai (`open`, `indikasi`, `disebut media`).
- OSINT hanya peran korporat/publik: jabatan, kepemilikan, transaksi, perkara hukum/regulator, jabatan publik.
  Jangan kumpulkan alamat rumah, kontak pribadi, data keluarga yang tidak relevan, kesehatan, atau agama.
- `website/*-verified.json`, `profil-pengendali.json`, dan `relasi-verified.json` adalah data kurasi: ubah dengan
  hati-hati, pertahankan field lama kecuali memang dikoreksi (sebutkan koreksinya).
- Data tim (item radar, berita, posisi diagram) ada di SQLite server, bukan di repo. Untuk uji, pakai salinan DB,
  jangan DB asli.

## Versi publik (Cloudflare Tunnel)

- Permintaan lewat domain publik membawa header `Cf-Connecting-Ip` dan diperlakukan hanya baca: semua tulis 403.
- Pengunjung publik hanya boleh memicu panggilan Stockbit untuk emiten di radar, dengan jatah 150 panggilan per
  10 menit dan tanpa `fresh`. Di luar itu yang tampil hanya cache.
- Fitur baru yang memanggil sumber luar per pengunjung harus melewati jalur cache (`cached_text`) supaya batas ini
  berlaku.

## Konvensi kode

- Antarmuka berbahasa Indonesia. Hindari gaya tulisan "AI slop": klaim berlebihan, kalimat penutup retoris, emoji.
- Warna dan ukuran memakai token di `frontend/src/tokens.css`. Jangan menulis warna mentah di komponen.
- Logika murni ditaruh di `frontend/src/lib/` dan diberi tes di `frontend/src/lib/__tests__/`. Perubahan server
  diberi tes di `website/test_server.py` (tanpa memanggil Stockbit sungguhan).
- Ikuti pola yang sudah ada di sekitar kode: kepadatan komentar, penamaan, idiom.
- Dependensi npm baru: cek lisensi dan `npm audit --omit=dev` sebelum PR.
