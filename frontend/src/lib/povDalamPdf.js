// Analisa mendalam POV (PDF, A4 tegak) dengan format riset yang sama dengan Berita/Seasonality:
// sampul berpita; kepemilikan & jaringan; riwayat & aksi korporasi; komunitas, dugaan tujuan, dan yang perlu diselidiki.
// Data dari /api/pov-dalam (server povdalam.analyze). Tanpa warna merah; faktor negatif memakai oranye.
import { MUTED, GOOD, BAD, INK, PRIMER, GOLD, LINE, TEAL, frame, heading, para } from './ihsgPdf.js'
import { sampul } from './ihsgModelPdf.js'
import { pdfText } from './deckPdf.js'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tgl = d => { const x = new Date(d); return isNaN(x) ? String(d || '-') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }
const potong = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s }
const p2 = v => v == null ? '-' : Number(v).toFixed(2).replace('.', ',') + '%'
const BAWAH = 272

// ins (opsional) = analisaInsider(...) dari baris insider terbaru: pemegang baru >=5% dan petunjuknya ikut dimuat.
export async function povDalamPdf(a, jsPDF, ins = null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const seri = `Analisa mendalam ${a.t}`
  let hal = 1, y = 0
  const halaman = judul => { doc.addPage(); hal += 1; frame(doc, judul, hal, seri); heading(doc, judul, 26); y = 37 }
  // Pindah halaman bila sisa ruang kurang dari h (judul halaman lanjutan diberi "(lanjutan)").
  let judulKini = ''
  const ruang = h => { if (y + h > BAWAH) halaman(`${judulKini} (lanjutan)`) }
  // Judul bagian tidak boleh tertinggal sendirian di dasar halaman: pastikan muat judul + ±2 baris isi.
  const sub = (text, color = PRIMER) => {
    ruang(26)
    doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(color); doc.text(pdfText(text), 14, y)
    doc.setDrawColor(color); doc.setLineWidth(0.4); doc.line(14, y + 1.6, 196, y + 1.6); y += 7
  }
  // links: URL sejajar dengan rows; butir dengan URL ditulis biru dan seluruh areanya bisa diklik.
  const butir = (rows, { size = 8.8, color = INK, tanda = '•', x = 18, w = 178, links = [] } = {}) => {
    rows.forEach((r, i) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size)
      const lines = doc.splitTextToSize(pdfText(`${tanda} ${r}`), w)
      const h = lines.length * size * 0.3528 * 1.4 + 1.4
      ruang(h)
      // Halaman baru mengganti font (judul); set ulang sebelum menulis agar ukuran tidak terbawa.
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size)
      const url = links[i]
      doc.setTextColor(url ? TEAL : color); doc.text(lines, x, y, { lineHeightFactor: 1.4 })
      if (url) doc.link(x, y - size * 0.3528, w, h - 1, { url })
      y += h
    })
  }
  const teks = (s, size = 9, color = INK) => { ruang(10); y = para(doc, s, 18, y, 178, size, color) }

  const k = a.kepemilikan, idn = a.identitas
  const kuat = [...a.dugaan].sort((p, q) => q.bukti.length - p.bukti.length)[0]
  sampul(doc, {
    besar: a.t, judul: 'Analisa mendalam', label: `${a.nama || a.t} · ${tgl(a.dibuat)}`,
    sub: [idn.sektor, idn.industri].filter(Boolean).join(' · ') + (kuat ? `. Dugaan terkuat: ${kuat.judul}.` : ''),
    updated: a.dibuat, seri: [],
    box: [['Pihak terafiliasi', p2(k.nonPublik)], ['Free float efektif', p2(k.ffEfektif)], ['Emiten di jaringan', String(a.sumber.jaringan)], ['Dugaan tujuan', String(a.dugaan.length)]],
    catatan: `Disusun otomatis dari ${a.sumber.pemegang} pemegang saham, ${a.sumber.insider} keterbukaan pemegang saham, ${a.sumber.keterbukaan} keterbukaan informasi, ${a.sumber.berita} berita, dan ${a.sumber.posting} posting publik Stockbit. Bukan ajakan membeli atau menjual efek.`,
  })

  // ---- Kepemilikan dan jaringan pengendali.
  // ---- Membaca arah pengendali (halaman utama analisa).
  if (a.arah) {
    judulKini = 'Membaca arah pengendali'; halaman(judulKini)
    for (const n of a.arah.narasi) { teks(n, 9); y += 1 }
    sub('Skenario ke mana saham dibawa', GOLD)
    a.arah.skenario.forEach((s, i) => {
      ruang(14)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(i === 0 ? GOOD : PRIMER)
      doc.text(pdfText(`${i + 1}. ${s.nama} (skor ${s.skor})`), 18, y); y += 5
      butir(s.bukti, { size: 8.4, tanda: '›', x: 22, w: 174 })
      butir([`Konfirmasi yang ditunggu: ${s.konfirmasi.join('; ')}`], { size: 8, color: MUTED, tanda: '', x: 22, w: 174 })
    })
    if (a.pertanyaan?.length) {
      sub('Jawaban pertanyaan kunci', GOLD)
      for (const q of a.pertanyaan) {
        ruang(16)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.3); doc.setTextColor(PRIMER)
        const h = doc.splitTextToSize(pdfText(q.q), 178); doc.text(h, 18, y, { lineHeightFactor: 1.3 }); y += h.length * 4.3 + 0.6
        butir([q.a], { size: 8.8, tanda: '→', x: 20, w: 176 })
        butir(q.bukti, { size: 8, color: MUTED, tanda: '›', x: 24, w: 172 }); y += 1
      }
    }
    if (a.backdoor) {
      sub(`Potensi backdoor / ganti pengendali: skor ${a.backdoor.skor}`, GOLD)
      butir(a.backdoor.bukti.length ? a.backdoor.bukti : ['Belum ada tanda yang biasa mendahului backdoor.'], { size: 8.6 })
      if (a.jejakCangkang?.length) { sub('Rekam jejak penjual cangkang', GOOD); butir(a.jejakCangkang.map(j => j.teks), { size: 8.6 }) }
      if (a.backdoor.rups?.length) { sub('Agenda RUPS / keterbukaan perubahan'); butir(a.backdoor.rups, { size: 8.3 }) }
    }
    // Galian lanjutan (versi analisa >= 21).
    const g = a.galian
    if (g) {
      sub('Kalender tahapan backdoor', GOLD)
      teks(`${g.kalender.ringkas} ${g.kalender.berikut}`, 8.8)
      butir(g.kalender.tahap.map(x => `${x.n}. ${x.nama}: ${x.status === 'terjadi' ? 'terjadi' + (x.tgl ? ' (' + tgl(x.tgl) + ')' : '') : 'belum terlihat'}`
        + (x.bukti.length ? ' — ' + x.bukti.slice(0, 2).join(' | ') : '')), { size: 8.3, tanda: '›' })
      if (g.harga.rows.length || g.harga.dokumen.length) {
        sub('Harga pengalihan vs harga pasar')
        butir(g.harga.rows.slice(0, 8).map(r => `${tgl(r.date)}: ${r.nama} ${r.arah}${r.chg != null ? ' ' + r.chg.toFixed(2).replace('.', ',') + ' poin' : ''} di Rp${Math.round(r.harga)}`
          + (r.pasar ? ` vs pasar Rp${Math.round(r.pasar)} (${r.selisih > 0 ? '+' : ''}${String(r.selisih).replace('.', ',')}%)` : '')), { size: 8.3 })
        butir(g.harga.dokumen.map(d => `${tgl(d.date)}: ${d.judul} — Rp${Math.round(d.harga)}`), { size: 8.3, links: g.harga.dokumen.map(d => d.url) })
        butir(g.harga.catatan, { size: 8.4, color: PRIMER, tanda: '›' })
      }
      if (g.rekam.emiten.length || g.rekam.berita.length) {
        sub('Rekam jejak UBO & emiten jaringannya', GOLD)
        butir(g.rekam.catatan, { size: 8.4, color: PRIMER, tanda: '›' })
        butir(g.rekam.emiten.map(e => e.teks), { size: 8.3 })
        butir(g.rekam.berita.slice(0, 8).map(b => `[${b.kategori.join(', ')}] ${b.date ? tgl(b.date) + ': ' : ''}${b.judul} (${b.sumber})`), { size: 8.2, links: g.rekam.berita.slice(0, 8).map(b => b.url) })
      }
      if (g.pengurus.length || g.alamat.length) {
        sub('Jejak pengurus, pemegang, dan alamat lintas emiten')
        butir([...g.pengurus.map(x => `${x.nama} (${x.peran}) juga: ${x.emiten.map(e => `${e.t} ${e.sebagai}`).join(', ')}`),
          ...g.alamat.map(x => `${x.t}: ${x.dasar} — ${x.alamat}`)], { size: 8.3 })
      }
      if (g.broker.rows.length) {
        sub('Identitas broker & sekuritas grup')
        butir(g.broker.catatan, { size: 8.4, color: PRIMER, tanda: '›' })
        butir(g.broker.rows.map(r => `${r.b} ${r.nama || '(nama belum dipetakan)'} · ${r.jenis}${r.grup ? ' · grup ' + r.grup + (r.satuGrup ? ' (satu grup dengan struktur)' : '') : ''}: ${r.peran.join('; ')}`), { size: 8.2 })
      }
      if (g.nominee.length) {
        sub('Deteksi nominee (indikasi)')
        butir(g.nominee.map(n => `${n.nama} ${p2(n.pct)}${n.kuat ? ' [indikasi kuat]' : ''}: ${n.tanda.join('; ')}`), { size: 8.3 })
      }
      if (g.ritel.seri.length) {
        sub('Tren jumlah pemegang saham (KSEI)')
        butir(g.ritel.catatan.length ? g.ritel.catatan : [`Terakhir ${Math.round(g.ritel.seri.at(-1).n)} pemegang (${tgl(g.ritel.seri.at(-1).d)}).`], { size: 8.4 })
      }
    }
    if (a.afiliasi?.kelompok?.length) {
      sub(`Peta afiliasi (terhubung ${p2(a.afiliasi.totalTerhubung)})`)
      butir(a.afiliasi.kelompok.map(k => `[${k.jenis}] ${p2(k.pct)} · ${k.dasar}: ${k.anggota.join(', ')}`), { size: 8.4 })
    }
    if (a.marketMaker?.length) { sub('Market maker: broker yang dipakai orang dalam'); butir(a.marketMaker, { size: 8.4 }) }
    if (a.target?.length) {
      sub('Skenario target harga (distribusi) — bukan rekomendasi', GOLD)
      butir(a.target.map(x => `${x.label}: Rp${Math.round(x.harga)} (${x.potensi > 0 ? '+' : ''}${String(x.potensi).replace('.', ',')}%) — ${x.dasar}`), { size: 8.5 })
    }
    if (a.sudut?.length) { sub('Sudut yang sering terlewat'); butir(a.sudut, { size: 8.5 }) }
    if (a.bandarmologi?.fase?.length) {
      sub('Bandarmologi')
      butir(a.bandarmologi.fase.map(f => `${f.periode}: ${f.arti}; net Rp${(f.bandar / 1e9).toFixed(2).replace('.', ',')} M; harga ${f.harga ?? '-'}%; pembeli ${f.akum.join(', ')}; penjual ${f.dist.join(', ')}${f.avgAkum ? '; modal pembeli Rp' + Math.round(f.avgAkum) : ''}`), { size: 8.4 })
      butir(a.bandarmologi.catatan, { size: 8.4, color: PRIMER, tanda: '›' })
    }
    if (a.volume?.length) { sub('Jejak lonjakan volume (1 tahun)'); butir(a.volume.slice(0, 8).map(v => `${tgl(v.d)}: ${v.kali}x rata-rata, harga ${v.ubah}%${v.sebelum ? ' — sebelum: ' + v.sebelum : ''}`), { size: 8.3 }) }
    if (a.preseden?.length) { sub('Preseden grup (2 tahun)'); butir(a.preseden, { size: 8.3 }) }
  }

  judulKini = 'Kepemilikan dan jaringan'; halaman(judulKini)
  if (a.ringkas.length) teks(a.ringkas.join('. ') + '.', 9.5)
  if (idn.latar) teks(potong(idn.latar, 600), 8.5, MUTED)
  if (a.radarSikap) { sub(`Sikap analisa radar: ${a.radarSikap.sikap}`, GOOD); teks(potong(a.radarSikap.ringkas, 360), 8.8) }
  sub(`Pemegang saham (terafiliasi ${p2(k.nonPublik)} · free float efektif ${p2(k.ffEfektif)})`)
  butir(k.pemegang.map(p => `${p.name} ${p2(p.pct)}${p.pengendali ? ' · pengendali' : ''}${p.pengurus ? ' · juga pengurus (' + p.pengurus + ')' : ''}${p.keluarga ? ' · keluarga ' + p.keluarga : ''}`))
  if (k.keluarga?.length) butir(k.keluarga.map(x => `Keluarga ${x.nama}: ${x.anggota.length} anggota, total ${p2(x.pct)}`), { color: PRIMER })
  if (k.ubo.length) butir([`Pemilik manfaat akhir (UBO): ${k.ubo.join(', ')}`], { color: PRIMER })
  if (k.direksi.length || k.komisaris.length) butir([`Direksi: ${k.direksi.join(', ') || '-'}`, `Komisaris: ${k.komisaris.join(', ') || '-'}`], { size: 8.2, color: MUTED })
  sub('Jaringan: kepemilikan pemegang saham di emiten lain', GOLD)
  const jar = a.jaringan.filter(r => r.emiten.length || r.keluar?.length)
  if (!jar.length) teks('Pemegang saham utama tidak tercatat memiliki emiten lain di data keterbukaan pemegang saham.', 9, MUTED)
  butir(jar.map(r => `${r.nama} (${p2(r.pct)} di ${a.t}): ${r.emiten.map(e => `${e.t} ${p2(e.pct)}`).join(', ') || '-'}`
    + (r.keluar?.length ? `; dilepas: ${r.keluar.map(e => `${e.t}${e.tgl ? ' (' + e.tgl + ')' : ''}`).join(', ')}` : '')))
  if (a.bersama.length) butir(a.bersama.map(x => `${x.t} dimiliki bersama oleh ${x.pemegang.join(', ')}`), { color: PRIMER, tanda: '›' })
  if (a.grup?.length) {
    sub('Emiten grup: pemegang utamanya')
    butir(a.grup.map(g => `${g.t}${g.nama ? ' (' + g.nama + ')' : ''}${g.sektor ? ' · ' + g.sektor : ''}: ${g.pemegang.map(p => `${p.name} ${p.pct || ''}`).join('; ')}`), { size: 8.2 })
  }

  // ---- Riwayat pengendalian, orang dalam, aksi korporasi, kinerja.
  judulKini = 'Riwayat dan aksi korporasi'; halaman(judulKini)
  if (a.kronologi?.length) { sub('Kronologi (terbaru dulu)'); butir(a.kronologi.slice(0, 16).map(k => `${tgl(k.date)} [${k.jenis}] ${potong(k.teks, 220)}`), { size: 8.3 }) }
  if (ins?.baru?.length) {
    sub('Pemegang baru ≥5% (90 hari) dan petunjuknya', GOLD)
    butir(ins.kalimat, { size: 8.8 })
    butir(ins.baru.map(b => `${b.nama}: ${b.tafsir}`), { size: 8.4, tanda: '›', x: 22, w: 174 })
    if (ins.cek.length) butir(ins.cek, { size: 8.4, tanda: '?', x: 22, w: 174 })
  }
  sub('Peristiwa kepemilikan penting (3 tahun)')
  if (!a.riwayat.length) teks('Tidak ada perubahan kepemilikan besar (melewati 20%/50% atau >= 5 poin) dalam 3 tahun.', 9, MUTED)
  butir(a.riwayat.map(r => `${tgl(r.date)}: ${r.teks}`))
  if (a.insider.length) {
    sub('Transaksi pemegang saham / orang dalam (180 hari)')
    butir(a.insider.map(x => `${x.nama}${x.role ? ' (' + x.role + ')' : ''}: ${x.chg > 0 ? '+' : ''}${x.chg.toFixed(2).replace('.', ',')} poin, ${x.n} transaksi, terakhir ${tgl(x.akhir)}`
      + (x.lembar ? `; ${(x.lembar / 1e6).toFixed(1).replace('.', ',')} juta lembar` : '') + (x.harga ? ` @ ±Rp${x.harga}` : '')
      + (x.sisa ? `; sisa ${(x.sisa / 1e6).toFixed(1).replace('.', ',')} juta lembar (${p2(x.sisaPct)})` : '')
      + (x.habisBulan ? `; habis ± ${Math.round(x.habisBulan)} bulan lagi bila laju sama` : '')),
      { color: INK })
  }
  sub('Keterbukaan aksi korporasi (1 tahun)')
  if (!a.aksi.length) teks('Tidak ada keterbukaan aksi korporasi yang terbaca dalam 1 tahun.', 9, MUTED)
  butir(a.aksi.slice(0, 14).map(x => `${tgl(x.date)}: ${x.judul}${x.inti ? ' — ' + potong(x.inti, 200) : ''}`), { size: 8.5, links: a.aksi.slice(0, 14).map(x => x.url) })
  if (a.tokoh?.length) {
    sub('Profil tokoh (UBO, pemegang perorangan, komut, dirut)')
    for (const o of a.tokoh) butir([`${o.nama}: ` + (o.berita.length ? o.berita.slice(0, 4).map(b => `${b.judul} (${b.sumber}${b.date ? ', ' + tgl(b.date) : ''})`).join(' | ') : 'tidak ada pemberitaan publik yang memuat nama ini.')], { size: 8.3 })
  }
  if (a.berita.length) {
    sub('Berita terbaru (Stockbit) — klik judul untuk membuka')
    butir(a.berita.slice(0, 8).map(b => `${tgl(b.date)}: ${b.judul}`), { size: 8.3, links: a.berita.slice(0, 8).map(b => b.url) })
  }
  if (a.beritaLuar?.length) {
    sub('Berita di luar Stockbit (media nasional) — klik judul untuk membuka')
    butir(a.beritaLuar.slice(0, 15).map(b => `${b.date ? tgl(b.date) : '-'}: ${b.judul} (${b.sumber})`), { size: 8.3, links: a.beritaLuar.slice(0, 15).map(b => b.url) })
  }

  // ---- Komunitas, dugaan, dan penyelidikan.
  judulKini = 'Dugaan dan penyelidikan'; halaman(judulKini)
  if (a.klaim?.some(c => c.status === 'didukung data')) {
    sub('Cek kebenaran klaim publik', PRIMER)
    for (const c of a.klaim.filter(c => c.status === 'didukung data')) {
      ruang(14)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(c.status === 'didukung data' ? GOOD : c.status === 'tidak didukung' ? BAD : MUTED)
      const h = doc.splitTextToSize(pdfText(`[${c.status}] "${potong(c.klaim, 200)}" (@${c.user}, ${tgl(c.d)})`), 178); doc.text(h, 18, y, { lineHeightFactor: 1.3 }); y += h.length * 4.2 + 0.6
      butir(c.bukti, { size: 8.3, tanda: '›', x: 22, w: 174 }); y += 0.8
    }
  }
  sub('Dugaan tujuan dan buktinya', GOLD)
  if (!a.dugaan.length) teks('Belum ada bukti yang cukup untuk menyusun dugaan tujuan.', 9, MUTED)
  for (const g of a.dugaan) {
    ruang(16)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(g.arah > 0 ? GOOD : g.keyakinan === 'tinggi' ? GOLD : PRIMER)
    const h = doc.splitTextToSize(pdfText(`${g.judul} (keyakinan ${g.keyakinan})`), 178); doc.text(h, 18, y, { lineHeightFactor: 1.3 }); y += h.length * 4.4 + 0.6
    butir(g.bukti, { size: 8.4, tanda: '›', x: 22, w: 174 }); y += 1
  }
  sub('Yang perlu diselidiki', PRIMER)
  butir(a.selidiki, { size: 8.6 })
  // Informasi dari sumber publik: terverifikasi data lebih dulu, lalu rumor (belum terverifikasi) dengan sumbernya.
  const kom = a.komunitas
  const rel = kom.relasi || [], klaim = kom.klaim || []
  const tokoh = kom.nama.filter(e => e.terverifikasi)
  if (rel.length || klaim.length || tokoh.length) {
    sub('Informasi dari sumber publik: terverifikasi', GOOD)
    const v = [...rel.filter(r => r.terverifikasi).map(r => `${r.orang} melalui ${r.badan} (cocok dengan data kepemilikan; sumber @${r.user})`),
      ...tokoh.map(e => `${e.nama}: tercatat di data pemegang saham/pengurus (disebut ${e.n}x)`)]
    if (!v.length) teks('Belum ada informasi publik yang cocok dengan data kepemilikan.', 8.8, MUTED)
    butir(v, { size: 8.6 })
    const r2 = [...rel.filter(r => !r.terverifikasi).map(r => `${r.orang} melalui ${r.badan} (@${r.user})`),
      ...klaim.slice(0, 8).map(c => `${potong(c.teks, 240)} (@${c.user}, ${tgl(c.d)})`)]
    if (r2.length) { sub('Rumor / klaim belum terverifikasi (cek dokumen sumber)', GOLD); butir(r2, { size: 8.3, color: MUTED }) }
  }
  if (a.catatan?.length) butir(a.catatan, { size: 7.8, color: BAD, tanda: '!' })

  const dis = 'Disusun otomatis oleh Radar Backdoor dari data Stockbit (profil, keterbukaan pemegang saham KSEI/IDX, keterbukaan informasi, berita, dan posting publik). '
    + 'Hubungan antarpihak dan dugaan tujuan dibaca dengan aturan otomatis; rumor dan klaim yang belum terverifikasi harus dicek di dokumen sumber. '
    + 'Bukan penawaran, ajakan, atau rekomendasi membeli atau menjual efek; keputusan investasi sepenuhnya tanggung jawab pembaca.'
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  const lines = doc.splitTextToSize(pdfText(dis), 182)
  ruang(lines.length * 3.4 + 6)
  doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.line(14, y + 1, 196, y + 1)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(MUTED); doc.text(lines, 14, y + 5, { lineHeightFactor: 1.35 })
  return doc
}

export const povDalamPdfName = a => `Analisa-Mendalam-${a.t}_${(a.dibuat || '').slice(0, 10) || new Date().toISOString().slice(0, 10)}.pdf`
