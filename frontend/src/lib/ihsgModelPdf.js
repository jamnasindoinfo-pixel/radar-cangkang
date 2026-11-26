// Riset IHSG Astronacci & Time Series (PDF, A4 tegak) dengan format yang sama seperti "Unduh riset IHSG":
// sampul krem dengan pita hijau-teal, judul serif, ringkasan berkotak, lalu halaman isi berbingkai, grafik, tabel, disclaimer.
// Data dari /api/ihsg-astro dan /api/ihsg-runtun (diambil segar saat tombol ditekan). Tanpa warna merah.
import { pdfText } from './deckPdf.js'
import { PAPER, PRIMER, GOLD, INK, MUTED, LINE, GOOD, BAD, TEAL, SOFT, frame, heading, para, block, kpi, fitText } from './ihsgPdf.js'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const n0 = v => v == null || isNaN(v) ? '-' : Math.round(v).toLocaleString('id-ID')
const pct = v => v == null || isNaN(v) ? '-' : `${v > 0 ? '+' : ''}${(+v).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`
const tgl = d => { const x = new Date(d); return isNaN(x) ? String(d || '') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }
// Huruf Yunani parameter model tidak tersedia di font PDF standar: tulis namanya.
const yunani = s => String(s || '').replace(/φ/g, 'phi').replace(/Φ/g, 'Phi').replace(/θ/g, 'theta').replace(/α/g, 'alpha').replace(/β/g, 'beta').replace(/γ/g, 'gamma')
const arahWarna = a => /naik|positif|support/i.test(a || '') ? GOOD : /turun|negatif|resistance/i.test(a || '') ? BAD : MUTED

// Sampul seragam dengan riset IHSG: pita vertikal, judul besar, subjudul, ornamen garis harga, kotak ringkasan.
export function sampul(doc, { judul, sub, label, updated, seri, box, catatan, besar = 'IHSG' }) {
  const terbit = tgl(new Date())
  doc.setFillColor(PAPER); doc.rect(0, 0, 210, 297, 'F')
  doc.setFillColor(PRIMER); doc.rect(0, 0, 16, 297, 'F')
  doc.setFillColor(GOLD); doc.rect(16, 0, 1.6, 297, 'F')
  doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(PRIMER); doc.text('RADAR BACKDOOR RESEARCH', 28, 26)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(MUTED); doc.text(pdfText(`Edisi ${terbit} · data per ${updated || '-'} WIB`), 196, 26, { align: 'right' })
  doc.setDrawColor(GOLD); doc.setLineWidth(0.4); doc.line(28, 30, 196, 30)
  doc.setFont('times', 'bold'); doc.setFontSize(96); doc.setTextColor(PRIMER); doc.text(besar, 26, 92)
  doc.setFont('times', 'italic'); doc.setFontSize(22); doc.setTextColor(INK); doc.text(pdfText(judul), 28, 108)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(GOLD); doc.text(pdfText(label), 28, 118)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(MUTED); doc.text(doc.splitTextToSize(pdfText(sub), 168), 28, 127)
  const s = (seri || []).filter(x => x > 0)
  if (s.length > 2) {
    const lo = Math.min(...s), hi = Math.max(...s), X = i => 28 + i / (s.length - 1) * 168, Y = v => 200 - (v - lo) / (hi - lo || 1) * 55
    doc.setDrawColor('#dfe5dc'); doc.setLineWidth(0.25); for (let k = 0; k <= 4; k++) doc.line(28, 145 + k * 13.75, 196, 145 + k * 13.75)
    doc.setDrawColor(PRIMER); doc.setLineWidth(0.7); for (let i = 1; i < s.length; i++) doc.line(X(i - 1), Y(s[i - 1]), X(i), Y(s[i]))
    doc.setFillColor(GOLD); doc.circle(X(s.length - 1), Y(s[s.length - 1]), 1.6, 'F')
  }
  const bw = (168 - 4 * (box.length - 1)) / box.length
  box.forEach(([k, v], i) => {
    const x = 28 + i * (bw + 4)
    doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.rect(x, 214, bw, 18, 'FD')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(MUTED); doc.text(pdfText(k), x + 4, 220.5)
    fitText(doc, v, x + 4, 228, bw - 6, box.length > 3 ? 11 : 12.5, { min: 7.5, color: PRIMER })
  })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(MUTED)
  doc.text(doc.splitTextToSize(pdfText(catatan || 'Disusun otomatis dari harga harian IHSG (Stockbit), kalender astronomis, dan berita pasar. Bukan ajakan membeli atau menjual efek.'), 168), 28, 250)
}

// Tabel sederhana: header berlatar lembut, baris bergaris tipis; kolom = [{ t, w, align }].
// opt.baru: fungsi pembuat halaman baru (mengembalikan y awal); bila diberikan, tabel panjang pindah halaman dan
// judul kolom diulang. Tanpa opt.baru tabel digambar apa adanya (dipakai halaman yang pasti muat).
export function tabel(doc, x, y, cols, rows, size = 8.5, opt = {}) {
  const kepala = () => {
    doc.setFillColor(SOFT); doc.rect(x, y - 4.6, cols.reduce((a, c) => a + c.w, 0), 6.6, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(size - 0.5); doc.setTextColor(PRIMER)
    let hx = x
    for (const c of cols) { doc.text(pdfText(c.t), c.align === 'right' ? hx + c.w - 1.5 : hx + 1.5, y, { align: c.align === 'right' ? 'right' : 'left' }); hx += c.w }
    y += 6.5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size)
  }
  kepala()
  let cx = x
  for (const r of rows) {
    const lines = cols.map((c, i) => doc.splitTextToSize(pdfText(String(r[i]?.t ?? r[i] ?? '')), c.w - 3))
    const h = Math.max(...lines.map(l => l.length)) * size * 0.3528 * 1.3 + 2.4
    if (opt.baru && y + h > (opt.bawah || 278)) { y = opt.baru() + 4; kepala() }
    cx = x
    cols.forEach((c, i) => {
      // Sel string biasa: String.prototype.bold adalah fungsi (truthy), jadi cek === true agar tidak semua tebal.
      doc.setTextColor(r[i]?.color || INK); doc.setFont('helvetica', r[i]?.bold === true ? 'bold' : 'normal')
      doc.text(lines[i], c.align === 'right' ? cx + c.w - 1.5 : cx + 1.5, y, { align: c.align === 'right' ? 'right' : 'left', lineHeightFactor: 1.3 })
      cx += c.w
    })
    doc.setDrawColor(LINE); doc.setLineWidth(0.2); doc.line(x, y + h - 3.6, cx, y + h - 3.6)
    y += h
  }
  return y + 2
}

export function disclaimer(doc, page, updated, metode) {
  doc.addPage(); frame(doc, 'Disclaimer', page)
  heading(doc, 'Disclaimer', 28)
  para(doc, `${metode} Riset ini disusun otomatis oleh Radar Backdoor dari data yang diyakini dapat diandalkan, namun tidak ada jaminan atas ketepatan, `
    + 'kelengkapan, atau kebenarannya. Pandangan dapat berubah tanpa pemberitahuan. Dokumen ini untuk edukasi dan kerangka berpikir; bukan penawaran, ajakan, '
    + 'atau rekomendasi untuk membeli atau menjual efek. Keputusan investasi sepenuhnya menjadi tanggung jawab pembaca; selalu terapkan manajemen risiko dan batas rugi.', 14, 40, 182, 10)
  doc.setFontSize(8); doc.setTextColor(MUTED); doc.text(pdfText(`Data per ${updated || '-'} · terbit ${tgl(new Date())}`), 14, 100)
}

// ======================= Astronacci =======================
export async function astroPdf(d, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pr = d.proyeksi || {}, rk = d.rekomendasi || {}
  sampul(doc, {
    judul: 'Astronacci: Siklus Bulan & Fibonacci', label: 'TIME SUPPORT · TIME RESISTANCE · FIBONACCI',
    sub: 'Gabungan fase bulan dan deklinasi bulan (Financial Astrology) dengan level serta hitungan waktu Fibonacci, diuji terhadap data historis.',
    updated: d.updated, seri: (d.riwayat || []).map(x => x.c),
    box: [['IHSG', n0(d.harga)], ['Bias', pr.bias ? pr.bias[0].toUpperCase() + pr.bias.slice(1) : '-'], ['Perkiraan', `${n0(pr.target)} (${pct(pr.ubah)})`], ['Rekomendasi', rk.tindakan || '-']],
  })

  // 2) Rekomendasi & proyeksi.
  let page = 2
  doc.addPage(); frame(doc, 'Rekomendasi & Proyeksi', page)
  heading(doc, 'Rekomendasi IHSG', 28)
  let y = 38
  doc.setFillColor('#ffffff'); doc.setDrawColor(GOLD); doc.setLineWidth(0.6); doc.rect(14, y - 5, 182, 30, 'FD')
  fitText(doc, rk.tindakan || '-', 19, y + 3, 120, 17, { min: 11, baris: 1, color: PRIMER })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(GOLD); doc.text(pdfText(`KEYAKINAN ${String(rk.keyakinan || '-').toUpperCase()}`), 192, y + 3, { align: 'right' })
  para(doc, rk.detail || '', 19, y + 10, 172, 9.5)
  y += 33
  for (const k of rk.konfirmasi || []) {
    doc.setFillColor(arahWarna(k.arah)); doc.circle(17, y - 1.3, 1.3, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(INK); doc.text(pdfText(`${k.nama}: `), 21, y)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(arahWarna(k.arah)); doc.text(pdfText(`${k.arah}${k.nilai != null ? ' (' + pct(k.nilai) + ')' : ''}`), 21 + doc.getTextWidth(pdfText(`${k.nama}: `)) + 1, y)
    y += 6
  }
  y += 4
  heading(doc, 'Proyeksi Astronacci', y, 15); y += 10
  const kw = (182 - 12) / 4
  ;[['Bias', pr.bias || '-', arahWarna(pr.bias)], ['Perkiraan', n0(pr.target), PRIMER], ['Perubahan', pct(pr.ubah), arahWarna(pr.ubah > 0 ? 'naik' : pr.ubah < 0 ? 'turun' : '')], ['Sampai fase', tgl(pr.sampai), PRIMER]]
    .forEach(([l, v, c], i) => kpi(doc, 14 + i * (kw + 4), y, kw, l, v, c))
  y += 26
  for (const s of pr.skenario || []) y = block(doc, s.nama, s.t, y + 2)
  // Grafik: harga 120 hari + level Fibonacci + jalur proyeksi.
  const h = d.riwayat || []
  if (h.length > 10) {
    const lv = [...(d.support || []), ...(d.resistance || [])]
    const jal = pr.jalur || []
    const n = h.length, extra = 45, X0 = 14, W = 182, H0 = y + 6, HH = Math.min(78, 270 - H0)
    const vals = [...h.map(x => x.c), ...jal.map(x => x.v), ...lv]
    const lo = Math.min(...vals) * 0.98, hi = Math.max(...vals) * 1.02
    const X = i => X0 + i / (n - 1 + extra) * W, Y = v => H0 + HH - (v - lo) / (hi - lo) * HH
    doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.rect(X0, H0, W, HH, 'FD')
    doc.setLineDashPattern([1.2, 1], 0); doc.setFontSize(7)
    for (const v of d.support || []) { doc.setDrawColor(GOOD); doc.line(X0, Y(v), X0 + W, Y(v)); doc.setTextColor(GOOD); doc.text(`S ${n0(v)}`, X0 + 1.5, Y(v) - 0.8) }
    for (const v of d.resistance || []) { doc.setDrawColor(BAD); doc.line(X0, Y(v), X0 + W, Y(v)); doc.setTextColor(BAD); doc.text(`R ${n0(v)}`, X0 + 1.5, Y(v) - 0.8) }
    doc.setLineDashPattern([], 0)
    doc.setDrawColor(PRIMER); doc.setLineWidth(0.55); for (let i = 1; i < n; i++) doc.line(X(i - 1), Y(h[i - 1].c), X(i), Y(h[i].c))
    // Jalur proyeksi: posisi hari bursa dari tanggal.
    const last = new Date(h[n - 1].d + 'T00:00:00')
    const idx = t => { const x = new Date(t + 'T00:00:00'); let k = 0; for (const z = new Date(last); z < x;) { z.setDate(z.getDate() + 1); if (z.getDay() % 6) k++ } return n - 1 + k }
    doc.setDrawColor(GOLD); doc.setLineWidth(0.7); doc.setLineDashPattern([1.5, 1], 0)
    for (let i = 1; i < jal.length; i++) doc.line(X(Math.min(idx(jal[i - 1].tgl), n - 1 + extra)), Y(jal[i - 1].v), X(Math.min(idx(jal[i].tgl), n - 1 + extra)), Y(jal[i].v))
    doc.setLineDashPattern([], 0)
    // Penanda time cluster (pita tipis).
    for (const k of d.klaster || []) {
      const i = idx(k.tgl); if (i > n - 1 + extra) continue
      doc.setDrawColor(k.label === 'Time support' ? GOOD : BAD); doc.setLineWidth(0.4); doc.line(X(i), H0 + 2, X(i), H0 + HH - 2)
    }
    doc.setFillColor(PRIMER); doc.circle(X(n - 1), Y(h[n - 1].c), 0.9, 'F')
    doc.setFontSize(7); doc.setTextColor(MUTED); doc.text(pdfText(tgl(h[0].d)), X0, H0 + HH + 4); doc.text(pdfText(`${tgl(h[n - 1].d)} → proyeksi`), X(n - 1), H0 + HH + 4, { align: 'center' })
    const lg = [[PRIMER, 'IHSG'], [GOLD, 'Jalur proyeksi'], [GOOD, 'Support / time support'], [BAD, 'Resistance / time resistance']]
    let lx = X0
    for (const [c, t] of lg) { doc.setDrawColor(c); doc.setLineWidth(0.8); doc.line(lx, H0 - 2.2, lx + 5, H0 - 2.2); doc.setTextColor(INK); doc.text(pdfText(t), lx + 6.5, H0 - 1.4); lx += 45 }
  }

  // 3) Time cluster, fase bulan, jendela waktu.
  doc.addPage(); frame(doc, 'Time Cluster & Siklus Bulan', ++page)
  heading(doc, 'Time Cluster', 28)
  y = para(doc, 'Tanggal yang berdekatan (±2 hari) dengan minimal dua jenis siklus: fase bulan utama, titik deklinasi bulan, dan hitungan waktu Fibonacci. '
    + 'Time support = perkiraan waktu dasar; time resistance = perkiraan waktu puncak.', 14, 37, 182, 9, MUTED)
  y = tabel(doc, 14, y + 2, [{ t: 'Tanggal', w: 32 }, { t: 'Jenis', w: 34 }, { t: 'Siklus yang bertemu', w: 100 }, { t: 'Kekuatan', w: 16, align: 'right' }],
    (d.klaster || []).map(k => [{ t: tgl(k.tgl), bold: true }, { t: k.label, color: k.label === 'Time support' ? GOOD : BAD, bold: true }, k.siklus.join('; '), `${k.kekuatan} siklus`]))
  if (d.ujiKlaster?.n) y = para(doc, `Uji 1 tahun: titik balik IHSG terjadi di sekitar ${d.ujiKlaster.balik}% dari ${d.ujiKlaster.n} klaster bulan, dibanding ${d.ujiKlaster.acak}% pada hari acak.`, 14, y + 1, 182, 9, MUTED)
  heading(doc, 'Fase bulan berikutnya', y + 8, 15)
  y = tabel(doc, 14, y + 18, [{ t: 'Tanggal', w: 45 }, { t: 'Jam (WIB)', w: 30 }, { t: 'Fase', w: 107 }],
    (d.fase || []).map(f => [{ t: tgl(f.tgl), bold: f.utama }, f.jam, { t: f.fase, color: f.utama ? PRIMER : INK, bold: f.utama }]))
  heading(doc, 'Deklinasi bulan', y + 6, 15)
  y = tabel(doc, 14, y + 16, [{ t: 'Tanggal', w: 45 }, { t: 'Peristiwa', w: 107 }, { t: 'Deklinasi', w: 30, align: 'right' }],
    (d.deklinasi || []).map(e => [tgl(e.tgl), e.jenis, `${String(e.v).replace('.', ',')}°`]))

  // 4) Fibonacci harga & waktu, uji historis.
  doc.addPage(); frame(doc, 'Fibonacci & Uji Historis', ++page)
  heading(doc, 'Tangga level Fibonacci', 28)
  const rows = (d.ayunan || []).flatMap(a => a.level.map(l => ({ ...l, ay: a.nama }))).sort((a, b) => b.v - a.v)
  y = tabel(doc, 14, 40, [{ t: 'Level', w: 52 }, { t: 'Ayunan', w: 62 }, { t: 'Harga', w: 30, align: 'right' }, { t: 'Jarak', w: 38, align: 'right' }],
    rows.map(l => [`${l.jenis} ${(l.rasio * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`, l.ay, { t: n0(l.v), bold: true }, { t: pct((l.v / d.harga - 1) * 100), color: l.v > d.harga ? GOOD : BAD }]), 8)
  for (const a of d.ayunan || []) y = para(doc, `${a.nama}: ${a.arah} dari ${tgl(a.dari)} ke ${tgl(a.ke)} (${n0(a.rendah)}–${n0(a.tinggi)}).`, 14, y, 182, 8.5, MUTED) - 1
  heading(doc, 'Hitungan waktu Fibonacci', y + 6, 15)
  y = tabel(doc, 14, y + 16, [{ t: 'Tanggal', w: 45 }, { t: 'Dari titik balik', w: 60 }, { t: 'Hitungan', w: 25, align: 'right' }, { t: 'Dekat fase bulan', w: 52 }],
    (d.waktu || []).slice(0, 12).map(w => [{ t: tgl(w.tgl), bold: !!w.bulan }, w.dari, `${w.hitungan} hari`, w.bulan ? { t: tgl(w.bulan), color: PRIMER, bold: true } : '-']), 8)
  heading(doc, 'Uji historis 1 tahun', y + 6, 15)
  y = tabel(doc, 14, y + 16, [{ t: 'Fase', w: 40 }, { t: 'Kejadian', w: 25, align: 'right' }, { t: 'Titik balik ±2 hari', w: 40, align: 'right' }, { t: 'Hari acak', w: 30, align: 'right' }, { t: 'Return 5 hari', w: 47, align: 'right' }],
    (d.uji || []).map(u => [u.fase, u.n, { t: `${u.balik}%`, bold: true, color: u.balik - u.acak >= 10 ? GOOD : INK }, `${u.acak}%`, `${pct(u.ret5)} (naik ${u.naik5}%)`]))
  y = block(doc, 'Kesimpulan', d.kesimpulan || '', y + 6)
  para(doc, d.catatan || '', 14, y + 2, 182, 8.5, MUTED)

  disclaimer(doc, ++page, d.updated, 'Fase bulan dihitung astronomis (algoritme Meeus, WIB); financial astrology belum terbukti secara ilmiah dan uji historisnya ditampilkan apa adanya.')
  return doc
}

// ======================= Time Series =======================
export async function runtunPdf(d, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pj = d.proyeksi || [], f = h => pj.find(x => x.h === h) || {}
  sampul(doc, {
    judul: 'Time Series: Model Runtun Waktu', label: 'AR · MA · ARMA · ARIMA · SARIMA · PEMULUSAN EKSPONENSIAL',
    sub: `Proyeksi gabungan ${d.model?.length || 0} model statistik yang diuji mundur, ditambah faktor sentimen berita, flow asing, dan musiman bulan kalender.`,
    updated: d.updated, seri: (d.riwayat || []).map(x => x.c),
    box: [['IHSG', n0(d.harga)], ['Esok', `${n0(f(1).sentimen)} (${pct(f(1).ubah)})`], ['1 minggu', `${n0(f(5).sentimen)} (${pct(f(5).ubah)})`], ['1 bulan', `${n0(f(21).sentimen)} (${pct(f(21).ubah)})`]],
  })

  // 2) Proyeksi & grafik.
  let page = 2
  doc.addPage(); frame(doc, 'Proyeksi Time Series', page)
  heading(doc, 'Proyeksi IHSG', 28)
  const kw = (182 - 8) / 3
  pj.forEach((p, i) => {
    const x = 14 + i * (kw + 4), y0 = 36
    doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.rect(x, y0, kw, 34, 'FD')
    doc.setFillColor(p.ubah >= 0 ? GOOD : BAD); doc.rect(x, y0, 1.6, 34, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(MUTED); doc.text(pdfText(p.nama.toUpperCase()), x + 5, y0 + 6.5)
    doc.setFont('times', 'bold'); doc.setFontSize(20); doc.setTextColor(PRIMER); doc.text(n0(p.sentimen), x + 5, y0 + 16)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(p.ubah >= 0 ? GOOD : BAD); doc.text(pdfText(pct(p.ubah)), x + 5, y0 + 22.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(MUTED)
    doc.text(pdfText(`Kisaran 80%: ${n0(p.bawah)}–${n0(p.atas)}`), x + 5, y0 + 27.5)
    doc.text(pdfText(`Model murni ${n0(p.murni)} · ${p.setuju}% bobot naik`), x + 5, y0 + 31.5)
  })
  // Grafik riwayat + jalur model + gabungan + kisaran.
  const h = d.riwayat || []
  let y = 80
  if (h.length > 10) {
    const n = h.length, tot = n + 21, X0 = 14, W = 182, H0 = 84, HH = 80
    const vals = [...h.map(x => x.c), ...pj.flatMap(x => [x.bawah, x.atas])]
    const lo = Math.min(...vals) * 0.99, hi = Math.max(...vals) * 1.01
    const X = i => X0 + i / (tot - 1) * W, Y = v => H0 + HH - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * HH
    doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.rect(X0, H0, W, HH, 'FD')
    doc.setDrawColor('#ebeee6'); doc.setLineWidth(0.2); for (let k = 1; k < 4; k++) doc.line(X0, H0 + HH * k / 4, X0 + W, H0 + HH * k / 4)
    // Kisaran 80% (garis tepi atas/bawah).
    const p0 = h[n - 1].c
    doc.setDrawColor(SOFT); doc.setLineWidth(0.6); doc.setDrawColor('#c9d8d0')
    let pa = [n - 1, p0], pb = [n - 1, p0]
    for (const p of pj) { doc.line(X(pa[0]), Y(pa[1]), X(n - 1 + p.h), Y(p.atas)); doc.line(X(pb[0]), Y(pb[1]), X(n - 1 + p.h), Y(p.bawah)); pa = [n - 1 + p.h, p.atas]; pb = [n - 1 + p.h, p.bawah] }
    // Jalur tiap model (tipis).
    doc.setLineWidth(0.2); doc.setDrawColor('#b9c2bd')
    for (const m of d.model || []) { let prev = [n - 1, p0]; m.jalur.forEach((v, i) => { doc.line(X(prev[0]), Y(prev[1]), X(n + i), Y(v)); prev = [n + i, v] }) }
    doc.setDrawColor(PRIMER); doc.setLineWidth(0.55); for (let i = 1; i < n; i++) doc.line(X(i - 1), Y(h[i - 1].c), X(i), Y(h[i].c))
    doc.setDrawColor(GOLD); doc.setLineWidth(0.9); let prev = [n - 1, p0]
    for (const p of pj) { doc.line(X(prev[0]), Y(prev[1]), X(n - 1 + p.h), Y(p.sentimen)); prev = [n - 1 + p.h, p.sentimen] }
    doc.setFillColor(PRIMER); doc.circle(X(n - 1), Y(p0), 0.9, 'F')
    doc.setFontSize(7); doc.setTextColor(MUTED); doc.text(pdfText(tgl(h[0].d)), X0, H0 + HH + 4); doc.text(pdfText(tgl(h[n - 1].d)), X(n - 1), H0 + HH + 4, { align: 'center' }); doc.text('+21 hari bursa', X0 + W, H0 + HH + 4, { align: 'right' })
    const lg = [[PRIMER, 'IHSG'], [GOLD, 'Gabungan + sentimen'], ['#b9c2bd', 'Jalur tiap model'], ['#c9d8d0', 'Kisaran 80%']]
    let lx = X0
    for (const [c, t] of lg) { doc.setDrawColor(c); doc.setLineWidth(0.8); doc.line(lx, H0 - 2.2, lx + 5, H0 - 2.2); doc.setTextColor(INK); doc.text(pdfText(t), lx + 6.5, H0 - 1.4); lx += 45 }
    y = H0 + HH + 10
  }
  heading(doc, 'Faktor yang ditambahkan', y + 4, 15); y += 13
  for (const fk of d.faktor || []) {
    const nilai = fk.nama.startsWith('Sentimen') ? ` (skor ${fk.nilai}; ${d.sentimen?.nPos || 0} positif, ${d.sentimen?.nNeg || 0} negatif)` : fk.nama.startsWith('Musiman') && fk.nilai != null ? ` (median bulan ini ${pct(fk.nilai)})` : ''
    doc.setFillColor(arahWarna(fk.arah)); doc.circle(17, y - 1.3, 1.3, 'F')
    y = para(doc, `${fk.nama}: ${fk.arah}${nilai} · efek ${String(fk.efek).replace(/√/g, 'akar ')}`, 21, y, 175, 9.5) - 1
  }
  if (d.garch) y = para(doc, `Volatilitas GARCH(1,1): gejolak harian ${String(d.garch.harian).replace('.', ',')}% (rata-rata jangka panjang ${String(d.garch.panjang).replace('.', ',')}%), dipakai untuk lebar kisaran 80%.`, 14, y + 2, 182, 9, MUTED)

  // 3) Tabel model.
  doc.addPage(); frame(doc, 'Model Runtun Waktu', ++page)
  heading(doc, 'Hasil tiap model', 28)
  y = para(doc, `Diuji mundur pada 40 hari terakhir. Galat = rata-rata selisih ramalan 1 hari / 5 hari; arah tepat 50% setara menebak. `
    + `Model dengan galat terkecil: ${(d.terbaik || []).join(', ')}.`, 14, 37, 182, 9, MUTED)
  y = tabel(doc, 14, y + 2, [{ t: 'Model', w: 64 }, { t: 'Esok', w: 17, align: 'right' }, { t: '1 minggu', w: 19, align: 'right' }, { t: '1 bulan', w: 19, align: 'right' }, { t: 'Galat 1h/5h', w: 29, align: 'right' }, { t: 'Arah', w: 16, align: 'right' }, { t: 'Bobot', w: 18, align: 'right' }],
    (d.model || []).map(m => [{ t: `${m.nama}${m.kalahPatokan ? ' *' : ''}`, bold: true }, n0(m.proy['1']), n0(m.proy['5']), { t: n0(m.proy['21']), color: m.proy['21'] >= d.harga ? GOOD : BAD },
      `${String(m.uji.mape1 ?? '-').replace('.', ',')}% / ${String(m.uji.mape5 ?? '-').replace('.', ',')}%`, `${m.uji.arah ?? '-'}%`, `${d.bobot?.[m.kunci] ?? 0}%`]), 8)
  y = para(doc, '* Galat 5 hari lebih besar dari patokan random walk + drift: model belum menambah ketepatan dibanding patokan.', 14, y, 182, 8, MUTED)
  heading(doc, 'Penjelasan model', y + 6, 15); y += 16
  for (const m of d.model || []) {
    if (y > 276) { doc.addPage(); frame(doc, 'Model Runtun Waktu', ++page); y = 28 }
    y = block(doc, `${m.nama} (${yunani(m.param)})`, m.ket, y)
  }

  disclaimer(doc, ++page, d.updated, 'Proyeksi statistik dari pola harga masa lalu; peristiwa baru di luar data (kebijakan, geopolitik) tidak tertangkap model.')
  return doc
}

const hariIni = () => new Date().toISOString().slice(0, 10)
export const astroPdfName = () => `Riset-IHSG_Astronacci_${hariIni()}.pdf`
export const runtunPdfName = () => `Riset-IHSG_Time-Series_${hariIni()}.pdf`
