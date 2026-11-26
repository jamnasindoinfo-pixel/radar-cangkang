// Riset aset emiten (PDF, A4 tegak) dengan format yang sama seperti "Unduh riset IHSG": sampul krem berpita hijau-teal,
// halaman berbingkai, tabel, dan disclaimer. Isi = tab Aset: riset lintas sumber (aset-riset.json), fakta dari laporan
// Stockbit terakhir, transaksi & KJPP (aset-verified.json), simulasi nilai KJPP otomatis, dampak ke saham, dan sumber.
import { pdfText } from './deckPdf.js'
import { PAPER, PRIMER, GOLD, INK, MUTED, LINE, GOOD, BAD, frame, heading, para, block, kpi, fitText } from './ihsgPdf.js'
import { tabel } from './ihsgModelPdf.js'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tgl = d => { const x = new Date(d); return isNaN(x) ? String(d || '') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }
const big = v => v == null || isNaN(v) ? '-' : v >= 1e12 ? `Rp${(v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T` : v >= 1e9 ? `Rp${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M` : `Rp${Math.round(v).toLocaleString('id-ID')}`

// d = { t, nama, aset, riset, fakta, ks, sim, dampak, mcap } (disusun TabAset).
export async function asetPdf(d, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const rs = d.riset || {}, av = d.aset || {}, a = av.aset || {}, k = av.kjpp || {}, sim = d.sim || {}
  const judulAset = a.nama || rs.entitas?.[0]?.nama || 'Aset yang diinjeksi'
  let page = 1, y = 0, judulKini = ''
  const baru = (judul) => { judulKini = judul; doc.addPage(); frame(doc, judul, ++page, `Riset Aset ${d.t}`); y = 28; return y }
  const lanjut = { baru: () => baru(judulKini + ' (lanjutan)') }
  const muat = (h, judul) => { if (y + h > 276) baru(judul) }

  // 1) Sampul.
  doc.setFillColor(PAPER); doc.rect(0, 0, 210, 297, 'F')
  doc.setFillColor(PRIMER); doc.rect(0, 0, 16, 297, 'F')
  doc.setFillColor(GOLD); doc.rect(16, 0, 1.6, 297, 'F')
  doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(PRIMER); doc.text('RADAR BACKDOOR RESEARCH', 28, 26)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(MUTED); doc.text(pdfText(`Edisi ${tgl(new Date())} · riset per ${tgl(rs.asOf) || '-'}`), 196, 26, { align: 'right' })
  doc.setDrawColor(GOLD); doc.setLineWidth(0.4); doc.line(28, 30, 196, 30)
  fitText(doc, d.t, 26, 92, 170, 96, { min: 48, baris: 1, color: PRIMER })
  doc.setFont('times', 'italic'); doc.setFontSize(22); doc.setTextColor(INK); doc.text(pdfText('Riset Aset Injeksi'), 28, 108)
  // Nama aset, keterangan, dan ringkasan disusun berurutan: posisi tiap bagian mengikuti tinggi bagian sebelumnya
  // (nama aset panjang, mis. SOFA, bisa 3 baris) dan ringkasan dipotong per baris agar berhenti sebelum kotak ringkasan.
  let cy = 118
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(GOLD)
  const nm = doc.splitTextToSize(pdfText(judulAset.toUpperCase()), 168).slice(0, 4)
  doc.text(nm, 28, cy, { lineHeightFactor: 1.25 }); cy += nm.length * 12 * 0.3528 * 1.25 + 3
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(MUTED)
  const ket = doc.splitTextToSize(pdfText([a.jenis, a.sektor, a.lokasi].filter(Boolean).join(' · ')), 168).slice(0, 3)
  if (ket.length) { doc.text(ket, 28, cy, { lineHeightFactor: 1.25 }); cy += ket.length * 10 * 0.3528 * 1.25 + 6 }
  // Ringkasan riset di sampul (maks. sampai di atas kotak ringkasan pada y = 232).
  if (rs.ringkasan) {
    doc.setFontSize(9.5); doc.setTextColor(INK)
    const lh = 9.5 * 0.3528 * 1.45, maks = Math.max(0, Math.floor((226 - cy) / lh))
    const rl = doc.splitTextToSize(pdfText(rs.ringkasan), 168)
    const tampil = rl.slice(0, maks)
    if (rl.length > maks && tampil.length) tampil[tampil.length - 1] = tampil[tampil.length - 1].replace(/\s*\S*$/, '') + '…'
    doc.text(tampil, 28, cy, { lineHeightFactor: 1.45 })
  }
  const box = [['Nilai transaksi', d.nilai ? big(d.nilai) : 'belum ada'], ['Porsi', String(a.porsi || '-').split(/[(;]/)[0].trim() || '-'],
    ['Penilaian KJPP', d.ks?.label || '-'], ['Sumber riset', `${(rs.sumber || []).length} sumber`]]
  const bw = (168 - 12) / 4
  box.forEach(([kk, v], i) => {
    const x = 28 + i * (bw + 4)
    doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.rect(x, 232, bw, 18, 'FD')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(MUTED); doc.text(pdfText(kk), x + 4, 238.5)
    fitText(doc, v, x + 4, 246, bw - 6, 11, { min: 7.5, color: PRIMER })
  })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(MUTED)
  doc.text(doc.splitTextToSize(pdfText('Disusun dari keterbukaan informasi (Stockbit Reports), media nasional/daerah/asing, situs perusahaan, filing bursa, regulator, dan jurnal ilmiah. Bukan ajakan membeli atau menjual efek.'), 168), 28, 262)

  // 2) Entitas & operasional (termasuk fakta laporan terakhir).
  baru('Entitas & Operasional')
  heading(doc, 'Entitas aset', y); y += 10
  if ((rs.entitas || []).length) y = tabel(doc, 14, y, [{ t: 'Entitas', w: 58 }, { t: 'Peran', w: 40 }, { t: 'Lokasi & kegiatan', w: 84 }],
    rs.entitas.map(e => [{ t: e.nama, bold: true }, e.peran, [e.lokasi, e.kegiatan].filter(Boolean).join(' · ')]), 8, lanjut)
  else y = para(doc, 'Entitas aset belum diungkap.', 14, y, 182, 9, MUTED)
  muat(30, 'Entitas & Operasional')
  heading(doc, 'Operasional', y + 4, 15); y += 14
  const ops = [...(d.fakta || []).map(f => [{ t: `${f.l} (laporan ${tgl(f.d)})`, bold: true, color: PRIMER }, f.t]), ...(rs.operasional || []).map(o => [{ t: o.l, bold: true }, o.t])]
  y = ops.length ? tabel(doc, 14, y, [{ t: 'Butir', w: 52 }, { t: 'Keterangan', w: 130 }], ops, 8, lanjut) : para(doc, 'Data operasional belum diungkap.', 14, y, 182, 9, MUTED)

  // 3) Tambang (bila ada), pasar, keuangan.
  const tb = rs.tambang
  if (tb) {
    muat(60, 'Tambang')
    heading(doc, 'Tambang: lokasi, cadangan, dan umur', y + 4, 15); y += 14
    const TB = [['Komoditas', tb.komoditas], ['Lokasi', tb.lokasi], ['Izin', tb.izin], ['Luas', tb.luas], ['Cadangan', tb.cadangan], ['Sumber daya', tb.sumberDaya], ['Standar', tb.standar],
      ['Kualitas', tb.kualitas], ['Produksi', tb.produksi], ['Umur tambang', tb.umur], ['Stripping ratio', tb.stripRatio], ['Infrastruktur', tb.infrastruktur]].filter(x => x[1])
    y = tabel(doc, 14, y, [{ t: 'Butir', w: 40 }, { t: 'Keterangan', w: 142 }], TB.map(([l, v]) => [{ t: l, bold: true }, v]), 8, lanjut)
  }
  if (rs.pasar) { muat(30, 'Pasar & Keuangan'); y = block(doc, 'Pasar dan pelanggan', rs.pasar, y + 6) }
  if ((rs.keuangan || []).length) {
    muat(30, 'Pasar & Keuangan')
    heading(doc, 'Keuangan aset', y + 4, 15); y += 14
    y = tabel(doc, 14, y, [{ t: 'Butir', w: 52 }, { t: 'Keterangan', w: 130 }], rs.keuangan.map(o => [{ t: o.l, bold: true }, o.t]), 8, lanjut)
  }

  // 4) Transaksi, KJPP, simulasi nilai, dampak ke saham.
  baru('Transaksi & Penilaian')
  heading(doc, 'Transaksi dan penilaian KJPP', y); y += 10
  const kw = (182 - 12) / 4
  ;[['Nilai transaksi', d.nilai ? big(d.nilai) : 'belum ada', PRIMER], ['Terhadap kapitalisasi', d.nilai && d.mcap ? `${(d.nilai / d.mcap).toLocaleString('id-ID', { maximumFractionDigits: 2 })}x` : '-', PRIMER],
    ['Status KJPP', d.ks?.label || '-', d.ks?.tone === 'good' ? GOOD : GOLD], ['Nilai KJPP', k.nilai || (k.nilaiRp ? big(k.nilaiRp) : 'belum ada'), PRIMER]]
    .forEach(([l, v, c], i) => kpi(doc, 14 + i * (kw + 4), y, kw, l, v, c))
  y += 26
  const tx = [['Cara bayar', av.transaksi?.caraBayar], ['Keterangan nilai', av.transaksi?.nilai], ['KJPP', k.nama], ['Tanggal laporan', k.tanggalLaporan && tgl(k.tanggalLaporan)],
    ['Metode', k.metode], ['Kesimpulan', k.kesimpulan], ['Catatan', k.dasar]].filter(x => x[1])
  if (tx.length) y = tabel(doc, 14, y, [{ t: 'Butir', w: 40 }, { t: 'Keterangan', w: 142 }], tx.map(([l, v]) => [{ t: l, bold: true }, v]), 8, lanjut)
  muat(50, 'Transaksi & Penilaian')
  heading(doc, 'Simulasi nilai KJPP (otomatis)', y + 4, 15); y += 14
  if (sim.mid != null) {
    y = tabel(doc, 14, y, [{ t: 'Pendekatan', w: 70 }, { t: 'Perhitungan', w: 78 }, { t: 'Nilai', w: 34, align: 'right' }],
      [...sim.rows.map(r => [{ t: r.k, bold: true }, `${r.how} · porsi ${Math.round(sim.por * 100)}%`, { t: big(r.v), bold: true }]),
        [{ t: 'Kisaran nilai wajar simulasi', bold: true, color: PRIMER }, 'nilai tengah ±25%', { t: `${big(sim.lo)} – ${big(sim.hi)}`, bold: true, color: PRIMER }],
        ...(sim.tx ? [[{ t: 'Nilai transaksi diumumkan', bold: true }, '', { t: big(sim.tx), bold: true }]] : [])], 8, lanjut)
    if (sim.verdict) y = block(doc, 'Kesimpulan simulasi', `${sim.verdict.t} Keyakinan ${sim.conf} (${sim.rows.length} pendekatan punya data).`, y + 4)
  } else y = para(doc, 'Simulasi belum bisa dihitung: data keuangan atau cadangan aset target belum diungkap; akan terhitung otomatis begitu datanya terbit.', 14, y, 182, 9, MUTED)
  if (d.dampak) {
    muat(30, 'Transaksi & Penilaian')
    heading(doc, `Dampak ke saham ${d.t}`, y + 4, 15); y += 14
    y = tabel(doc, 14, y, [{ t: 'Butir', w: 70 }, { t: 'Nilai', w: 112 }], d.dampak.map(([l, v]) => [{ t: l, bold: true }, v]), 8, lanjut)
  }

  // 5) Aset lain pengendali, jurnal, pendukung & risiko, celah data.
  baru('Pengendali, Jurnal & Risiko')
  if ((rs.pengendaliAset || []).length) {
    heading(doc, 'Aset lain milik pengendali', y); y += 10
    y = tabel(doc, 14, y, [{ t: 'Aset', w: 50 }, { t: 'Jenis & lokasi', w: 46 }, { t: 'Detail & kaitan', w: 86 }],
      rs.pengendaliAset.map(e => [{ t: e.nama, bold: true }, [e.jenis, e.lokasi].filter(Boolean).join(' · '), [e.detail, e.hubungan && 'Kaitan: ' + e.hubungan].filter(Boolean).join(' ')]), 8, lanjut)
  }
  if ((rs.jurnal || []).length) {
    muat(30, 'Pengendali, Jurnal & Risiko')
    heading(doc, 'Temuan jurnal ilmiah', y + 4, 15); y += 14
    for (const j of rs.jurnal) { muat(18, 'Pengendali, Jurnal & Risiko'); y = block(doc, `${j.judul}${j.tahun ? ' (' + j.tahun + ')' : ''}`, `${[j.penulis, j.terbitan].filter(Boolean).join(' · ')}. ${j.temuan || ''}`, y + 2) }
  }
  for (const [lbl, list, col] of [['Pendukung nilai aset', rs.positif, GOOD], ['Risiko aset', rs.risiko, BAD], ['Data yang belum diungkap', [...(rs.belumDitemukan || []), ...(av.tidakDitemukan || [])], MUTED]]) {
    if (!(list || []).length) continue
    muat(24, 'Pengendali, Jurnal & Risiko')
    heading(doc, lbl, y + 4, 15); y += 13
    for (const t of list) {
      muat(10, 'Pengendali, Jurnal & Risiko')
      doc.setFillColor(col); doc.circle(16, y - 1.2, 1.1, 'F')
      y = para(doc, t, 20, y, 176, 9) - 1.5
    }
  }

  // 6) Sumber.
  const src = [...(rs.sumber || []).map(s => [s.t, s.jenis || '', s.url || '']), ...(av.sumber || []).map(t => [t, 'dokumen', ''])]
  if (src.length) {
    baru('Sumber')
    heading(doc, `Sumber (${src.length})`, y); y += 10
    src.forEach(([t, j, u], i) => {
      muat(12, 'Sumber')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(PRIMER); doc.text(`${i + 1}.`, 14, y)
      y = para(doc, `${t}${j ? ' · ' + j : ''}${u ? '\n' + u : ''}`, 21, y, 175, 8, INK) - 1.5
    })
  }

  // 7) Disclaimer.
  baru('Disclaimer')
  heading(doc, 'Disclaimer', y)
  para(doc, 'Riset aset ini disusun otomatis oleh Radar Backdoor dari keterbukaan informasi dan sumber publik yang diyakini dapat diandalkan, namun tidak ada jaminan atas '
    + 'ketepatan, kelengkapan, atau kebenarannya. Simulasi nilai KJPP adalah perkiraan berbasis pembanding, bukan penilaian resmi. Dokumen ini untuk edukasi; bukan penawaran, '
    + 'ajakan, atau rekomendasi untuk membeli atau menjual efek. Keputusan investasi sepenuhnya menjadi tanggung jawab pembaca.', 14, y + 12, 182, 10)
  return doc
}

export const asetPdfName = t => `Riset-Aset_${t}_${new Date().toISOString().slice(0, 10)}.pdf`
