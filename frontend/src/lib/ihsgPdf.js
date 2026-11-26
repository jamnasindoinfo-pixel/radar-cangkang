// Riset IHSG (PDF, A4 tegak) dari data /api/ihsg-outlook: sampul, Analisa Teknikal & Flow (grafik, narasi,
// area beli/target/risiko), proyeksi arah, Seasonality & sentimen, berita sentimen positif/negatif IHSG, dan disclaimer. Digambar dengan jsPDF (mm).
// Tema terang Radar Backdoor: kertas krem, hijau-teal tua sebagai warna utama, aksen emas, judul serif (tanpa merah).
import { pdfText } from './deckPdf.js'

export const PAPER = '#fbf8f1', PRIMER = '#17494d', GOLD = '#c8962c', INK = '#2b2620', MUTED = '#7a7166', LINE = '#e6dccb'
export const GOOD = '#2e8b57', BAD = '#d9822b', TEAL = '#3b7ea1', SOFT = '#eef1ea'
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const n0 = v => v == null ? '-' : Math.round(v).toLocaleString('id-ID')
const tgl = d => { const x = new Date(d); return isNaN(x) ? String(d || '') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }
const nadaWarna = a => a === 'positif' ? GOOD : a === 'negatif' ? BAD : MUTED

// Latar krem + pita hijau-teal di atas + kaki halaman dengan nomor dalam bulatan emas.
export function frame(doc, title, page, seri = 'Riset IHSG') {
  doc.setFillColor(PAPER); doc.rect(0, 0, 210, 297, 'F')
  doc.setFillColor(PRIMER); doc.rect(0, 0, 210, 11, 'F')
  doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor('#ffffff'); doc.text('RADAR BACKDOOR RESEARCH', 14, 7.4)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(pdfText(title), 196, 7.4, { align: 'right' })
  doc.setDrawColor(GOLD); doc.setLineWidth(0.5); doc.line(14, 285, 186, 285)
  doc.setFontSize(8); doc.setTextColor(MUTED); doc.text(pdfText(`${seri} · ${title}`), 14, 290)
  doc.setFillColor(GOLD); doc.circle(193, 286, 4, 'F'); doc.setFont('helvetica', 'bold'); doc.setTextColor('#ffffff'); doc.text(String(page), 193, 287.3, { align: 'center' })
}

// Teks dalam kotak sempit tanpa terpotong: ukuran huruf dikecilkan sampai muat satu baris (sampai min),
// bila tetap terlalu panjang dipecah menjadi maks. `baris` baris pada ukuran min. Mengembalikan ukuran yang dipakai.
export function fitText(doc, text, x, y, w, size, { min = 8, baris = 2, font = ['times', 'bold'], color } = {}) {
  const t = pdfText(String(text ?? ''))
  doc.setFont(...font); if (color) doc.setTextColor(color)
  let sz = size
  for (; sz > min; sz -= 0.5) { doc.setFontSize(sz); if (doc.getTextWidth(t) <= w) break }
  doc.setFontSize(sz)
  if (doc.getTextWidth(t) <= w) { doc.text(t, x, y); return sz }
  const lines = doc.splitTextToSize(t, w)
  const shown = lines.slice(0, baris)
  if (lines.length > baris) shown[baris - 1] = shown[baris - 1].replace(/\s*\S*$/, '') + '…'
  doc.text(shown, x, y - (shown.length - 1) * sz * 0.3528 * 0.55, { lineHeightFactor: 1.1 })
  return sz
}

// Judul bagian: serif hijau-teal dengan garis bawah emas.
export function heading(doc, text, y, size = 18) {
  doc.setFont('times', 'bold'); doc.setFontSize(size); doc.setTextColor(PRIMER); doc.text(pdfText(text), 14, y)
  doc.setDrawColor(GOLD); doc.setLineWidth(0.8); doc.line(14, y + 2.2, 14 + Math.min(182, doc.getTextWidth(pdfText(text)) + 4), y + 2.2)
}

export function para(doc, text, x, y, w, size = 10, color = INK) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(color)
  const lines = doc.splitTextToSize(pdfText(text), w)
  doc.text(lines, x, y, { lineHeightFactor: 1.45 })
  return y + lines.length * size * 0.3528 * 1.45 + 3
}

// Paragraf berlabel (Struktur / Flow / Rencana) dengan penanda emas di kiri.
export function block(doc, label, text, y) {
  doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(PRIMER)
  const lines = doc.splitTextToSize(pdfText(label), 178)
  doc.setFillColor(GOLD); doc.rect(14, y - 3.4, 1.2, 4.4 + (lines.length - 1) * 4.6, 'F')
  doc.text(lines, 18, y, { lineHeightFactor: 1.2 })
  return para(doc, text, 18, y + 5 + (lines.length - 1) * 4.6, 178)
}

function chart(doc, tek, x, y, w, h) {
  const s = tek.seri || []
  if (s.length < 2) return
  const lv = [...(tek.support || []), ...(tek.resistance || [])].map(v => v.v)
  const ys = [...s.map(p => p.c), ...s.map(p => p.e50), ...s.map(p => p.e200), ...lv]
  const lo = Math.min(...ys) * 0.99, hi = Math.max(...ys) * 1.01
  const X = i => x + i / (s.length - 1) * w, Y = v => y + h - (v - lo) / (hi - lo) * h
  doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.rect(x, y, w, h, 'FD')
  // Garis kisi horizontal tipis.
  doc.setDrawColor('#ebeee6'); doc.setLineWidth(0.2)
  for (let k = 1; k < 4; k++) doc.line(x, y + h * k / 4, x + w, y + h * k / 4)
  doc.setLineDashPattern([1.2, 1], 0); doc.setFontSize(7)
  for (const l of tek.support || []) { doc.setDrawColor(GOOD); doc.line(x, Y(l.v), x + w, Y(l.v)); doc.setTextColor(GOOD); doc.text(`S ${n0(l.v)}`, x + 1.5, Y(l.v) - 0.8) }
  for (const l of tek.resistance || []) { doc.setDrawColor(BAD); doc.line(x, Y(l.v), x + w, Y(l.v)); doc.setTextColor(BAD); doc.text(`R ${n0(l.v)}`, x + 1.5, Y(l.v) - 0.8) }
  doc.setLineDashPattern([], 0)
  const line = (k, color, lw) => { doc.setDrawColor(color); doc.setLineWidth(lw); for (let i = 1; i < s.length; i++) doc.line(X(i - 1), Y(s[i - 1][k]), X(i), Y(s[i][k])) }
  line('e200', GOLD, 0.45); line('e50', TEAL, 0.4); line('c', PRIMER, 0.55)
  doc.setFillColor(PRIMER); doc.circle(X(s.length - 1), Y(s[s.length - 1].c), 0.9, 'F')
  doc.setFontSize(7); doc.setTextColor(MUTED)
  ;[0, Math.floor(s.length / 2), s.length - 1].forEach((i, k) => doc.text(pdfText(tgl(s[i].d)), X(i), y + h + 4, { align: k === 0 ? 'left' : k === 2 ? 'right' : 'center' }))
  // Legenda.
  const lg = [[PRIMER, `IHSG ${n0(tek.harga)}`], [TEAL, `EMA50 ${n0(tek.ema50)}`], [GOLD, `EMA200 ${n0(tek.ema200)}`]]
  let lx = x
  for (const [c, t] of lg) { doc.setDrawColor(c); doc.setLineWidth(0.8); doc.line(lx, y - 2.2, lx + 5, y - 2.2); doc.setTextColor(INK); doc.text(pdfText(t), lx + 6.5, y - 1.4); lx += 38 }
}

export function kpi(doc, x, y, w, label, value, color) {
  doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.rect(x, y, w, 19, 'FD')
  doc.setFillColor(color); doc.rect(x, y, 1.6, 19, 'F')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(MUTED); doc.text(pdfText(label), x + 5, y + 6.5)
  fitText(doc, value, x + 5, y + 14.5, w - 7, 14, { min: 8.5, color })
}

// Keterangan relatif bulan terpilih agar "Desember" saat masih November tidak membingungkan.
export const relBulan = (b, now = new Date()) => {
  const ini = now.getMonth() + 1
  return b === ini ? ' (BULAN INI)' : b === ini % 12 + 1 ? ' (BULAN DEPAN)' : ''
}

export async function ihsgPdf(d, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const bln = BLN[(d.bulan || 1) - 1], terbit = tgl(new Date()), r = d.riset || {}, t = d.tek, lv = r.level || {}

  // 1) Sampul: krem, pita hijau-teal vertikal, judul serif, grafik IHSG sebagai ornamen.
  doc.setFillColor(PAPER); doc.rect(0, 0, 210, 297, 'F')
  doc.setFillColor(PRIMER); doc.rect(0, 0, 16, 297, 'F')
  doc.setFillColor(GOLD); doc.rect(16, 0, 1.6, 297, 'F')
  doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(PRIMER); doc.text('RADAR BACKDOOR RESEARCH', 28, 26)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(MUTED); doc.text(pdfText(`Edisi ${terbit} · data per ${d.updated || '-'} WIB`), 196, 26, { align: 'right' })
  doc.setDrawColor(GOLD); doc.setLineWidth(0.4); doc.line(28, 30, 196, 30)
  doc.setFont('times', 'bold'); doc.setFontSize(96); doc.setTextColor(PRIMER); doc.text('IHSG', 26, 92)
  doc.setFont('times', 'italic'); doc.setFontSize(22); doc.setTextColor(INK); doc.text(pdfText('Analisa Teknikal & Flow'), 28, 108)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(GOLD); doc.text(pdfText(`SEASONALITY ${bln.toUpperCase()}${relBulan(d.bulan)}`), 28, 118)
  // Ornamen: garis harga IHSG 1 tahun.
  const s = t.seri || []
  if (s.length > 2) {
    const lo = Math.min(...s.map(p => p.c)), hi = Math.max(...s.map(p => p.c)), X = i => 28 + i / (s.length - 1) * 168, Y = v => 200 - (v - lo) / (hi - lo || 1) * 55
    doc.setDrawColor('#dfe5dc'); doc.setLineWidth(0.25); for (let k = 0; k <= 4; k++) doc.line(28, 145 + k * 13.75, 196, 145 + k * 13.75)
    doc.setDrawColor(PRIMER); doc.setLineWidth(0.7); for (let i = 1; i < s.length; i++) doc.line(X(i - 1), Y(s[i - 1].c), X(i), Y(s[i].c))
    doc.setFillColor(GOLD); doc.circle(X(s.length - 1), Y(s[s.length - 1].c), 1.6, 'F')
  }
  // Ringkasan di sampul.
  const pe = d.proyeksi?.horizon?.[0]
  const box = [['Tren', t.tren], ['IHSG', n0(t.harga)], ['Probabilitas berulang', `${d.berulang?.prob ?? '-'}% (${d.berulang?.label || '-'})`]]
  if (pe) box.push(['Proyeksi esok', `${pe.prob >= 55 ? 'Naik' : pe.prob <= 45 ? 'Turun' : 'Mendatar'} (${pe.prob}% naik)`])
  const bw = (168 - 4 * (box.length - 1)) / box.length
  box.forEach(([k, v], i) => {
    const x = 28 + i * (bw + 4)
    doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.rect(x, 214, bw, 18, 'FD')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(MUTED); doc.text(pdfText(k), x + 4, 220.5)
    fitText(doc, v, x + 4, 228, bw - 6, box.length > 3 ? 11 : 12.5, { min: 7.5, color: PRIMER })
  })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(MUTED); doc.text('Disusun oleh', 28, 252); doc.text('Terbit', 100, 252)
  doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(INK); doc.text('Radar Backdoor', 28, 258); doc.text(pdfText(terbit), 100, 258)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(MUTED)
  doc.text(pdfText('Disusun otomatis dari data publik (Stockbit) sebagai kerangka berpikir; bukan rekomendasi beli/jual.'), 28, 286)

  // 2) Analisa Teknikal & Flow.
  doc.addPage(); frame(doc, 'Analisa Teknikal & Flow', 2)
  heading(doc, 'Analisa Teknikal & Flow', 26)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(t.tren === 'Uptrend' ? GOOD : t.tren === 'Downtrend' ? BAD : GOLD)
  doc.text(pdfText(`${t.tren.toUpperCase()}  ·  data ${tgl(t.tanggal)}`), 196, 26, { align: 'right' })
  chart(doc, t, 14, 40, 182, 76)
  let y = 130
  y = block(doc, 'Struktur', r.struktur || '', y)
  if (r.flow) y = block(doc, 'Flow broker', r.flow, y + 2)
  y = block(doc, 'Rencana', r.rencana || '', y + 2)
  const yk = Math.min(y + 3, 260), kw = (182 - 8) / 3
  kpi(doc, 14, yk, kw, 'Area beli (bertahap)', lv.beli ? `${n0(lv.beli[0])} - ${n0(lv.beli[1])}` : '-', TEAL)
  kpi(doc, 14 + kw + 4, yk, kw, 'Target', lv.target ? `${n0(lv.target[0])} / ${n0(lv.target[1])}` : '-', GOOD)
  kpi(doc, 14 + 2 * (kw + 4), yk, kw, 'Risiko (penutupan harian <)', n0(lv.risiko), BAD)

  // 3) Proyeksi arah IHSG (esok, 1 minggu, 1 bulan).
  let page = 2
  const pr = d.proyeksi
  if (pr) {
    doc.addPage(); frame(doc, 'Proyeksi Arah IHSG', ++page)
    heading(doc, 'Proyeksi Arah IHSG', 26)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(MUTED)
    doc.text(pdfText(`IHSG ${n0(pr.harga)} · data per ${d.updated || '-'} WIB`), 196, 26, { align: 'right' })
    const cw = (182 - 8) / 3
    pr.horizon.forEach((h, i) => {
      const x = 14 + i * (cw + 4), col = h.prob >= 55 ? GOOD : h.prob <= 45 ? BAD : GOLD
      doc.setFillColor('#ffffff'); doc.setDrawColor(i === 0 ? PRIMER : LINE); doc.setLineWidth(i === 0 ? 0.6 : 0.3); doc.rect(x, 34, cw, 50, 'FD')
      doc.setFillColor(col); doc.rect(x, 34, 1.6, 50, 'F')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(MUTED); doc.text(pdfText(h.nama.toUpperCase()), x + 5, 40)
      doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(col); doc.text(doc.splitTextToSize(pdfText(h.arah), cw - 8)[0], x + 5, 47.5)
      doc.setFontSize(26); doc.text(`${h.prob}%`, x + 5, 60)
      const pw0 = doc.getTextWidth(`${h.prob}%`)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(MUTED); doc.text('peluang naik', x + 7 + pw0, 60)
      doc.setFillColor(BAD); doc.rect(x + 5, 63, cw - 10, 2, 'F'); doc.setFillColor(GOOD); doc.rect(x + 5, 63, (cw - 10) * h.prob / 100, 2, 'F')
      doc.setFontSize(8.5); doc.setTextColor(INK); doc.text(pdfText(`Kisaran ${n0(h.bawah)} - ${n0(h.atas)}`), x + 5, 71)
      doc.setFontSize(7.5); doc.setTextColor(MUTED); doc.text(pdfText(`Historis: median ${h.median > 0 ? '+' : ''}${h.median ?? '-'}% (${h.n} kejadian)`), x + 5, 76.5)
      if (h.level?.length) doc.text(pdfText(`Level di kisaran: ${h.level.map(n0).join(', ')}`), x + 5, 81.5)
    })
    y = 96
    y = block(doc, 'Skenario sesi berikutnya', pr.skenarioEsok, y)
    // Tabel pivot sesi berikutnya.
    const pv = pr.pivot, cols = [['S2', pv.s2, BAD], ['S1', pv.s1, BAD], ['Pivot', pv.p, INK], ['R1', pv.r1, GOOD], ['R2', pv.r2, GOOD]]
    const pw = 182 / cols.length
    cols.forEach(([k, v, col], i) => {
      doc.setFillColor(i % 2 ? '#ffffff' : SOFT); doc.rect(14 + i * pw, y, pw, 14, 'F')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(MUTED); doc.text(k, 14 + i * pw + pw / 2, y + 5, { align: 'center' })
      doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(col); doc.text(n0(v), 14 + i * pw + pw / 2, y + 11.5, { align: 'center' })
    })
    y += 20
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(MUTED)
    doc.text(pdfText(`ATR14 ${n0(pr.atr)} poin · perubahan 1 hari ${pr.ubah1}% · 5 hari ${pr.ubah5}%`), 14, y); y += 8
    doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(PRIMER); doc.text('Dasar perhitungan', 14, y); y += 5
    for (const h of pr.horizon) {
      y = para(doc, `${h.nama}: ` + h.komponen.map(k => `${k.nama} ${k.nilai}% (bobot ${Math.round(k.bobot * 100)}%)`).join('; ') + '.', 14, y, 182, 8.5, INK) - 1
    }
    para(doc, 'Kisaran = harga terakhir ± ATR14 × akar jumlah hari. Peluang empiris = persentase kejadian naik pada kondisi teknikal yang sama '
      + 'selama 1 tahun terakhir. ' + pr.catatan, 14, y + 2, 182, 8, MUTED)
  }

  // 4) Seasonality & sentimen.
  doc.addPage(); frame(doc, 'Seasonality & Sentimen', ++page)
  heading(doc, `Seasonality ${bln} & Sentimen`, 26)
  const b = d.berulang || {}
  const bc = b.label === 'Tinggi' ? GOOD : b.label === 'Rendah' ? BAD : GOLD
  doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.rect(14, 34, 182, 30, 'FD'); doc.setFillColor(bc); doc.rect(14, 34, 1.6, 30, 'F')
  doc.setFont('times', 'bold'); doc.setFontSize(32); doc.setTextColor(bc); doc.text(`${b.prob ?? '-'}%`, 20, 54)
  doc.setFontSize(12); doc.setTextColor(INK); doc.text(pdfText(`Probabilitas pola ${bln} berulang · ${b.label || '-'}`), 62, 42)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(MUTED)
  ;(b.komponen || []).forEach((k, i) => doc.text(pdfText(`${k.nama}: ${k.nilai}% (bobot ${Math.round(k.bobot * 100)}%)`), 62, 49 + i * 5))
  y = 74
  const m = d.musiman || {}, c = d.kondisi || {}
  y = block(doc, 'Pola musiman 10 tahun', `IHSG naik ${m.up ?? '-'} dari ${m.n ?? '-'} tahun pada ${bln} (${m.prob ?? '-'}%), median ${m.median ?? '-'}%.`, y)
  y = block(doc, 'Kondisi tren yang sama', `Akhir bulan sebelumnya IHSG di ${c.kondisi || '-'} rata-rata 10 bulan, seperti sekarang: naik ${c.up ?? '-'} dari ${c.n ?? '-'} tahun${c.prob != null ? ` (${c.prob}%)` : ''}. `
    + (c.tahun || []).map(x => `${x.tahun}: ${x.ret > 0 ? '+' : ''}${x.ret}%`).join('; ') + '.', y + 2)
  const sn = d.sentimen || {}
  y += 4
  doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(PRIMER)
  doc.text(pdfText(`Sentimen pasar: ${sn.arah || '-'}`), 14, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(MUTED)
  doc.text(pdfText(`${sn.nPos || 0} positif / ${sn.nNeg || 0} negatif dari ${sn.total || 0} berita terkait IHSG`), 196, y, { align: 'right' })
  // Batang proporsi positif/negatif.
  const tot = Math.max(1, (sn.nPos || 0) + (sn.nNeg || 0))
  doc.setFillColor(BAD); doc.rect(14, y + 3, 182, 2.6, 'F'); doc.setFillColor(GOOD); doc.rect(14, y + 3, 182 * (sn.nPos || 0) / tot, 2.6, 'F')
  y += 12
  for (const tp of sn.topik || []) {
    const col = nadaWarna(tp.arah)
    doc.setFillColor(col); doc.circle(15.5, y - 1.2, 1.1, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(INK); doc.text(pdfText(tp.nama), 19, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(col)
    doc.text(pdfText(`${tp.n} berita · ${tp.nPos}+ / ${tp.nNeg}- · ${tp.arah}`), 196, y, { align: 'right' })
    y = para(doc, tp.implikasi, 19, y + 4.6, 176, 9, MUTED) - 0.5
  }

  // 5) Berita sentimen IHSG: positif lalu negatif (hanya berita yang berdampak ke IHSG), terbaru dulu.
  doc.addPage(); frame(doc, 'Sentimen IHSG', ++page)
  const ensure = need => { if (y + need > 278) { doc.addPage(); frame(doc, 'Sentimen IHSG', ++page); y = 22 } }
  // Satu berita: penanda nada, judul, waktu · sumber, dampak ke IHSG, ringkasan isi, tautan ke artikel asli.
  const berita = (x, x0, maxL) => {
    const w = 196 - x0, col = nadaWarna(x.nada)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.3)
    const ring = doc.splitTextToSize(pdfText(x.ringkas || 'Ringkasan tidak disediakan sumber ini; buka tautan untuk isi lengkap.'), w).slice(0, maxL)
    doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8.3)
    const dp = x.dampak ? doc.splitTextToSize(pdfText(`Dampak ke IHSG: ${x.dampak}${x.kunci?.length ? ` (kata kunci: ${x.kunci.join(', ')})` : ''}`), w) : []
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
    const jd = doc.splitTextToSize(pdfText(x.judul || ''), w - 42)
    ensure(10 + jd.length * 4.2 + (dp.length + ring.length) * 3.7)
    doc.setFillColor(col); doc.circle(x0 - 2.6, y - 1.2, 1.1, 'F')
    doc.setTextColor(INK); doc.text(jd, x0, y)
    const jam = (x.t || '').length > 10 ? ' ' + x.t.slice(11, 16) : ''
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(MUTED)
    doc.text(pdfText(`${tgl(x.d)}${jam}`), 196, y, { align: 'right' })
    doc.setFont('helvetica', 'bold'); doc.setTextColor(PRIMER); doc.text(pdfText(x.sumber || 'Stockbit'), 196, y + 3.6, { align: 'right' })
    y += Math.max(jd.length * 4.2, 7.4)
    if (dp.length) { doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8.3); doc.setTextColor(col); doc.text(dp, x0, y); y += dp.length * 3.7 }
    if (ring.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.3); doc.setTextColor('#4f5650'); doc.text(ring, x0, y); y += ring.length * 3.7 }
    const asal = /stockbit\.com/.test(x.url || '') ? 'Stockbit' : (x.sumber || 'sumber')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(TEAL); doc.textWithLink(pdfText(`Baca berita lengkap di ${asal} >`), x0, y + 0.5, { url: x.url })
    doc.setDrawColor(LINE); doc.setLineWidth(0.2); doc.line(x0, y + 2.6, 196, y + 2.6); y += 8
  }
  heading(doc, 'Berita Sentimen IHSG', 26)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(MUTED)
  doc.text(pdfText(`diambil ${d.updated || '-'} WIB`), 196, 26, { align: 'right' })
  y = 36
  y = para(doc, `Dari ${sn.totalSemua || 0} berita pasar (${(d.sumberBerita || []).join(', ')}), ${sn.total || 0} berkaitan langsung dengan IHSG: `
    + `${sn.nPos || 0} bernada positif dan ${sn.nNeg || 0} bernada negatif. Nada ditentukan dari kata kunci judul (ringkasan bila judul netral); `
    + 'konteks mata uang, imbal hasil, dan suku bunga diperhitungkan (mis. dolar menguat = negatif bagi IHSG).', 14, y, 182, 8.3, MUTED) + 1
  for (const [arr, label, col, n] of [[sn.positif, 'Sentimen Positif IHSG', GOOD, sn.nPos], [sn.negatif, 'Sentimen Negatif IHSG', BAD, sn.nNeg]]) {
    ensure(30)
    doc.setFillColor(SOFT); doc.rect(14, y - 4.6, 182, 7.4, 'F'); doc.setFillColor(col); doc.rect(14, y - 4.6, 1.8, 7.4, 'F')
    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(col); doc.text(pdfText(label), 18.5, y)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(pdfText(`${n || 0} berita · ditampilkan ${Math.min(12, (arr || []).length)} terbaru`), 194, y, { align: 'right' })
    y += 8
    if (!(arr || []).length) { y = para(doc, 'Belum ada berita bernada ini dalam data terkini.', 18, y, 178, 9, MUTED) + 2; continue }
    for (const x of arr.slice(0, 12)) berita(x, 20, 6)
    y += 3
  }

  // 6) Disclaimer.
  doc.addPage(); frame(doc, 'Disclaimer', ++page)
  heading(doc, 'Disclaimer', 28)
  para(doc, 'Riset ini disusun otomatis oleh Radar Backdoor dari data yang diyakini dapat diandalkan (harga, ringkasan broker, dan berita pasar Stockbit), '
    + 'namun tidak ada jaminan atas ketepatan, kelengkapan, atau kebenarannya. Pandangan dapat berubah tanpa pemberitahuan. Dokumen ini untuk edukasi '
    + 'dan kerangka berpikir; bukan penawaran, ajakan, atau rekomendasi untuk membeli atau menjual efek. Keputusan investasi sepenuhnya menjadi tanggung jawab pembaca; '
    + 'selalu terapkan manajemen risiko dan batas rugi.', 14, 40, 182, 10)
  doc.setFontSize(8); doc.setTextColor(MUTED); doc.text(pdfText(`Data per ${d.updated || '-'} · terbit ${terbit}`), 14, 90)
  return doc
}

export const ihsgPdfName = bulan => `Riset-IHSG_Seasonality-${BLN[(bulan || 1) - 1]}_${new Date().toISOString().slice(0, 10)}.pdf`
