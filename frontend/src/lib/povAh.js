// POV AH: format dan saringan untuk hasil /api/pov-ah (portofolio Andry Hakim + screening saham beredar sedikit).

// Jumlah lembar ringkas: 220 jt, 1,05 M (miliar lembar).
export const lembar = v => v == null ? '–' : v >= 1e9
  ? `${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M lbr`
  : `${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt lbr`

// Jalur kepemilikan AH di satu saham sebagai teks pendek.
export function jalurTeks(j) {
  if (j.jenis === 'pribadi') return `pribadi ${String(j.pct).replace('.', ',')}% (KSEI)`
  if (j.jenis === 'PT') return `lewat ${j.nama} ${String(j.pct).replace('.', ',')}% (${j.status})`
  return `di bawah 1% / lewat pihak lain (${j.status})`
}

// Saringan tampilan screening: batas saham beredar, batas porsi publik, hanya yang ada rekan AH, kata kunci kode/nama.
export function saringAh(rows, { maksSaham = Infinity, maksFF = Infinity, rekan = false, cari = '' } = {}) {
  const q = cari.trim().toLowerCase()
  return (rows || []).filter(r =>
    (r.saham == null || r.saham <= maksSaham) &&
    (r.ff == null || r.ff <= maksFF) &&
    (!rekan || (r.jejak || []).length > 0) &&
    (!q || r.t.toLowerCase().includes(q) || (r.nama || '').toLowerCase().includes(q)))
}

// Perubahan jumlah pemegang ±3 bulan sebagai teks dan nada (turun = akumulasi).
export function trenTeks(tr) {
  if (!tr) return { teks: '–', nada: '' }
  const s = (tr.ubah > 0 ? '+' : '') + tr.ubah.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'
  return { teks: s, nada: tr.ubah <= -5 ? 'akumulasi' : tr.ubah >= 5 ? 'distribusi' : '' }
}

// Rekomendasi POV AH: n saham teratas dari screening yang status perdagangannya sudah dicek, tanpa notasi khusus/UMA,
// dan jumlah pemegangnya menyusut ≥5% (tanda pengumpulan). Urut skor, lalu penyusutan pemegang terdalam.
// Kalau kurang dari n, sisanya diisi baris bersih lain berdasar skor.
export function pilihRekomendasi(rows, n = 5) {
  const bersih = (rows || []).filter(r => r.dicek !== false && !r.suspen && !r.uma && !(r.notasi || []).length && r.ff != null)
  const kumpul = r => r.tren && r.tren.ubah <= -5
  const urut = (a, b) => b.skor - a.skor || (a.tren?.ubah ?? 0) - (b.tren?.ubah ?? 0)
  const utama = bersih.filter(kumpul).sort(urut)
  return [...utama, ...bersih.filter(r => !kumpul(r)).sort(urut)].slice(0, n)
}
