// Posisi panel yang bisa ditarik (kotak gambar pola di chart Harmonic Pattern): selalu dijepit di dalam wadah.

// Jepit posisi kiri-atas panel (ukuran.w x ukuran.h) agar seluruhnya tetap di dalam wadah (wadah.w x wadah.h).
// Panel yang lebih besar dari wadah ditempel di 0.
export function jepitPanel(pos, ukuran, wadah) {
  const maxX = Math.max(0, wadah.w - ukuran.w), maxY = Math.max(0, wadah.h - ukuran.h)
  return { x: Math.round(Math.min(maxX, Math.max(0, pos.x))), y: Math.round(Math.min(maxY, Math.max(0, pos.y))) }
}

// Posisi baru saat ditarik: posisi awal + selisih pointer sejak mulai, lalu dijepit.
export function geserPanel(awal, mulai, kini, ukuran, wadah) {
  return jepitPanel({ x: awal.x + kini.x - mulai.x, y: awal.y + kini.y - mulai.y }, ukuran, wadah)
}

// Posisi tersimpan (localStorage) yang sah, atau null.
export function bacaPosisi(teks) {
  try {
    const v = JSON.parse(teks)
    return v && isFinite(v.x) && isFinite(v.y) ? { x: Number(v.x), y: Number(v.y) } : null
  } catch { return null }
}
