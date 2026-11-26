// Chart candlestick vektor untuk PDF (cadangan bila foto chart di layar gagal diambil): candle + volume, garis XABCD,
// pita PRZ, stop, dan target, atau swing terakhir bila tanpa pola. Dipakai harmonicViewPdf.js.
import { MUTED, GOOD, BAD, INK, PRIMER, GOLD, LINE } from './ihsgPdf.js'
import { pdfText } from './deckPdf.js'
import { idxTanggal } from './harmonik.js'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tgl = d => { const x = new Date(String(d || '').slice(0, 10)); return isNaN(x) ? String(d || '-') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }
const n = v => v == null || isNaN(v) ? '-' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 })

// Chart candlestick dalam kotak (x, y, w, h); 78% tinggi untuk harga, sisanya volume.
export function chartPdf(doc, bars, r, pivot, x, y, w, h) {
  const d0 = r?.titik?.[0]?.d || pivot?.[0]?.d
  const awal = Math.max(0, Math.min(d0 ? idxTanggal(bars, d0) - 15 : bars.length - 120, bars.length - 90))
  const vis = bars.slice(awal)
  const kanan = 22, wp = w - kanan, hp = h * 0.78, hv = h - hp - 4
  const ekstra = r ? [...(r.prz || []), r.stop, ...(r.target || [])].filter(v => v != null) : []
  let lo = Math.min(...vis.map(b => b.l), ...ekstra), hi = Math.max(...vis.map(b => b.h), ...ekstra)
  const pad = (hi - lo) * 0.04 || 1; lo -= pad; hi += pad
  const bw = wp / vis.length, X = i => x + (i + 0.5) * bw, Y = v => y + hp * (1 - (v - lo) / (hi - lo))
  const vMaks = Math.max(...vis.map(b => b.v), 1), YV = v => y + h - hv * v / vMaks
  doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.rect(x, y, w, h, 'FD')
  doc.setDrawColor('#ebeee6'); doc.setLineWidth(0.2)
  for (let k = 1; k < 4; k++) doc.line(x, y + hp * k / 4, x + wp, y + hp * k / 4)
  doc.setFontSize(6.5); doc.setTextColor(MUTED)
  for (let k = 0; k <= 4; k++) { const v = hi - (hi - lo) * k / 4; doc.text(n(Math.round(v)), x + w - 1, y + hp * k / 4 + (k ? 1 : 3), { align: 'right' }) }
  // PRZ, stop, target.
  const tl = (v, warna, teks) => {
    doc.setDrawColor(warna); doc.setLineWidth(0.3); doc.setLineDashPattern([1.2, 1], 0); doc.line(x, Y(v), x + wp, Y(v)); doc.setLineDashPattern([], 0)
    doc.setFontSize(6.5); doc.setTextColor(warna); doc.text(pdfText(teks), x + wp + 1, Y(v) + 1)
  }
  if (r?.prz) {
    const t = (r.titik || []).find(z => z.n === 'D') || (r.titik || []).find(z => z.n === 'C')
    const px = t ? X(idxTanggal(bars, t.d) - awal) : x + wp * 0.8
    doc.setFillColor('#f6ead2'); doc.rect(px, Y(r.prz[1]), x + wp - px, Math.max(0.6, Y(r.prz[0]) - Y(r.prz[1])), 'F')
    doc.setFontSize(6.5); doc.setTextColor(GOLD); doc.text('PRZ', x + wp + 1, (Y(r.prz[0]) + Y(r.prz[1])) / 2 + 1)
    tl(r.stop, BAD, `Stop ${n(r.stop)}`)
    ;(r.target || []).forEach((v, i) => tl(v, GOOD, `T${i + 1} ${n(v)}`))
  }
  // Candle dan volume (naik hijau, turun oranye).
  vis.forEach((b, i) => {
    const naik = b.c >= b.o, warna = naik ? GOOD : BAD
    doc.setDrawColor(warna); doc.setLineWidth(Math.max(0.12, Math.min(0.3, bw * 0.15))); doc.line(X(i), Y(b.h), X(i), Y(b.l))
    doc.setFillColor(warna)
    doc.rect(X(i) - bw * 0.35, Y(Math.max(b.o, b.c)), Math.max(0.2, bw * 0.7), Math.max(0.2, Math.abs(Y(b.o) - Y(b.c))), 'F')
    doc.setFillColor(naik ? '#cfe3d6' : '#f3dcc3'); doc.rect(X(i) - bw * 0.35, YV(b.v), Math.max(0.2, bw * 0.7), y + h - YV(b.v), 'F')
  })
  // Garis pola XABCD (atau swing terakhir, putus-putus).
  const src = r?.titik?.length ? r.titik : (pivot || []).map(p => ({ n: '', d: p.d, p: p.p }))
  const pts = src.map(t => ({ ...t, i: idxTanggal(bars, t.d) - awal })).filter(t => t.i >= 0)
  doc.setDrawColor(PRIMER); doc.setLineWidth(r ? 0.6 : 0.35)
  if (!r) doc.setLineDashPattern([1, 0.8], 0)
  for (let k = 1; k < pts.length; k++) doc.line(X(pts[k - 1].i), Y(pts[k - 1].p), X(pts[k].i), Y(pts[k].p))
  doc.setLineDashPattern([], 0)
  pts.forEach((t, k) => {
    const a = pts[k - 1], b = pts[k + 1], puncak = (!a || t.p >= a.p) && (!b || t.p >= b.p)
    doc.setFillColor('#ffffff'); doc.setDrawColor(PRIMER); doc.setLineWidth(0.4); doc.circle(X(t.i), Y(t.p), 0.9, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(INK)
    doc.text(pdfText(`${t.n ? t.n + ' ' : ''}${n(t.p)}`), X(t.i), puncak ? Y(t.p) - 2 : Y(t.p) + 4, { align: 'center' })
  })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(MUTED)
  ;[0, Math.floor(vis.length / 2), vis.length - 1].forEach((i, k) => doc.text(pdfText(tgl(vis[i].d)), X(i), y + h + 4, { align: k === 0 ? 'left' : k === 2 ? 'right' : 'center' }))
  // Keterangan simbol.
  const lg = [[GOOD, 'kotak', 'Candle naik'], [BAD, 'kotak', 'Candle turun'], [PRIMER, 'garis', r ? 'Garis pola XABCD' : 'Swing terakhir (pivot >= 6%)'],
    ...(r ? [['#f6ead2', 'kotak', 'PRZ'], [BAD, 'putus', 'Stop loss'], [GOOD, 'putus', 'Target 1 & 2']] : [])]
  let lx = x
  const ly = y + h + 9
  doc.setFontSize(7)
  for (const [c, jenis, t] of lg) {
    if (jenis === 'kotak') { doc.setFillColor(c); doc.rect(lx, ly - 2.4, 4, 2.6, 'F') } else {
      doc.setDrawColor(c); doc.setLineWidth(0.6); if (jenis === 'putus') doc.setLineDashPattern([1, 0.7], 0)
      doc.line(lx, ly - 1.1, lx + 4, ly - 1.1); doc.setLineDashPattern([], 0)
    }
    doc.setTextColor(INK); doc.text(pdfText(t), lx + 5.5, ly); lx += doc.getTextWidth(pdfText(t)) + 11
  }
}
