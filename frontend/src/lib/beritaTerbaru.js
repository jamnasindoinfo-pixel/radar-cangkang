// Analisa otomatis untuk laporan/berita TERBARU satu emiten: ringkasan, poin kunci, tingkat sinyal, dampak terhadap
// pemegang saham publik (Positif/Netral/Negatif beserta alasan dari isi dokumen), kaitan dengan tesis analisa kurasi
// (pandangan-analis.json), dan hal yang dipantau. Deterministik dari data sinkron Stockbit; dipakai tab Berita dan PDF.
import { UTYPES, tglHargaAcuan } from './domain.js'
import { newsTake, maxAmountRp } from './news.js'
import { faktaAset, laporanMaterial, RUTIN_RX } from './pembaruan.js'
import { selidikBerita } from './selidikBerita.js'
import { INSIDER_BELI, INSIDER_JUAL } from './insider.js'

const day = u => String(u.date || '').slice(0, 10)
const isReport = u => /^sb-report-/.test(String(u.id || ''))
const intiOf = s => (String(s || '').match(/Inti:\s*(.+?)\s*(\(Ringkasan AI Stockbit\))?$/) || [])[1] || ''
const bersih = s => String(s || '').replace(/\s*\(Ringkasan AI Stockbit\)\s*$/, '').replace(/\s*Inti:\s*.+$/, '').trim()
const rp = v => v == null ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')

// Laporan/berita paling baru satu emiten; pada tanggal yang sama keterbukaan resmi didahulukan.
export function beritaTerakhir(updates, ticker) {
  return (updates || []).filter(u => u.ticker === ticker && u.title)
    .sort((a, b) => day(b).localeCompare(day(a)) || isReport(b) - isReport(a) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null
}

// Dampak dua sisi dari isi dokumen: [pola, sisi (1 positif / -1 negatif), teks]. Teks memakai isi dokumen;
// afiliasi tidak dihitung negatif (hanya transaksi yang merugikan publik secara terukur).
const SISI = [
  [INSIDER_BELI, 1, 'Orang dalam (komisaris/direksi/pengendali) menambah kepemilikan: sinyal keyakinan terhadap prospek perseroan.'],
  [/pendirian anak usaha|mendirikan anak usaha|anak usaha baru/i, 1, 'Ekspansi lewat anak usaha baru; kinerjanya dikonsolidasikan ke perseroan.'],
  [/(akuisisi|mengakuisisi|pengambilalihan|inbreng)/i, 1, 'Masuknya aset atau usaha baru berpotensi menambah skala dan pendapatan perseroan.'],
  [/kontrak|proyek|tender proyek|kantongi|memperoleh pesanan/i, 1, 'Kontrak atau proyek baru menambah sumber pendapatan ke depan.'],
  [/laba (bersih )?(naik|tumbuh|melonjak|melambung)|berbalik laba|pendapatan (naik|tumbuh|melonjak)|lonjakan pendapatan|tumbuh solid/i, 1, 'Kinerja keuangan membaik dibanding periode sebelumnya.'],
  [/penawaran tender|tender offer/i, 1, 'Penawaran tender memberi pemegang saham publik pilihan keluar di harga yang ditetapkan.'],
  [/pembeli siaga|dana segar|penambahan modal|private placement|pmthmetd|hmetd|rights issue/i, 1, 'Tambahan modal memperkuat permodalan untuk rencana usaha.'],
  [/pengesahan|disetujui|menyetujui|izin (usaha )?(terbit|diperoleh)|pernyataan efektif/i, 1, 'Persetujuan atau pengesahan resmi sudah diperoleh, mengurangi ketidakpastian pelaksanaan.'],
  [/\brugi\b|\bturun\b|merosot|anjlok|penurunan pendapatan/i, -1, 'Ada indikasi penurunan kinerja atau kerugian yang perlu dicermati.'],
  [/pmthmetd|private placement|hmetd|rights issue|penambahan modal|saham baru/i, -1, 'Penerbitan saham baru berpotensi mendilusi pemegang saham publik yang tidak ikut menebus.'],
  [/pinjaman|kredit|utang|obligasi/i, -1, 'Tambahan pinjaman menambah beban bunga dan risiko keuangan.'],
  [/\buma\b|suspensi|penghentian sementara|permintaan penjelasan bursa/i, -1, 'Perhatian bursa menandakan volatilitas harga yang tinggi.'],
  [/gagal kuorum|tidak kuorum|ditunda|penundaan|\bbatal\b|pembatalan/i, -1, 'Penundaan atau kegagalan agenda membuat jadwal aksi korporasi tidak pasti.'],
  [/sanksi|denda|pelanggaran/i, -1, 'Sanksi regulator menambah risiko reputasi dan kepatuhan.'],
]

// Daftar dampak positif dan negatif yang terbaca dari isi dokumen (judul, ringkasan, poin), dilengkapi fakta angka.
export function duaSisi(u, { tesis = null, rutin = false } = {}) {
  const text = `${u.title || ''} ${u.summary || ''} ${u.points || ''}`
  const pos = [], neg = []
  for (const [rx, sisi, teks] of SISI) if (rx.test(text)) (sisi > 0 ? pos : neg).push(teks)
  // Fakta angka dari dokumen.
  const pct = [...text.matchAll(/(\d{1,3}(?:,\d+)?)\s*%/g)].map(m => parseFloat(m[1].replace(',', '.')))
  const milik = /kepemilikan|porsi|menguasai|memiliki/i.test(text) ? pct.find(v => v >= 50) : undefined
  if (milik != null) pos.push(`Kepemilikan ${String(milik).replace('.', ',')}% memberi kendali penuh atas entitas tersebut.`)
  const amt = maxAmountRp(text)
  // Pembelian/penjualan saham oleh orang dalam bukan investasi perseroan: catatan nilai investasi tidak berlaku.
  const insider = INSIDER_BELI.test(text) || INSIDER_JUAL.test(text)
  if (!insider && /anak usaha|akuisisi|kontrak|proyek|investasi/i.test(text) && !amt) neg.push('Nilai investasi dan proyeksi kontribusi pendapatan belum diungkap, sehingga dampaknya belum terukur.')
  if (/bergerak di bidang|kegiatan usaha|bidang usaha/i.test(text) && /anak usaha|diversifikasi|perubahan kegiatan/i.test(text)) neg.push('Bidang usaha baru perlu dibuktikan keterkaitannya dengan usaha inti; ada risiko eksekusi.')
  if (tesis?.posisi && /di atas rentang/.test(tesis.posisi)) neg.push(`${tesis.posisi} Ruang kenaikan dari berita ini relatif terbatas.`)
  if (tesis?.posisi && /di bawah rentang/.test(tesis.posisi)) pos.push(`${tesis.posisi} Ada ruang bagi harga untuk menyesuaikan.`)
  const uniq = a => [...new Set(a)]
  if (rutin) return { positif: [], negatif: [], catatan: 'Dokumen administratif: tidak ada dampak langsung terhadap nilai saham.' }
  // Penjualan saham oleh orang dalam tanpa faktor lain: netral, perlu dicermati alasannya (bukan otomatis negatif).
  if (INSIDER_JUAL.test(text) && !INSIDER_BELI.test(text) && !pos.length && !neg.length)
    return { positif: [], negatif: [], catatan: 'Orang dalam mengurangi kepemilikan; perlu dicermati alasannya, bukan otomatis negatif.', netral: true }
  return { positif: uniq(pos), negatif: uniq(neg), catatan: '' }
}

const DAMPAK = { 1: ['Positif', 'good'], 0: ['Netral', 'calm'], [-1]: ['Negatif', 'bad'] }

export function analisaBerita(u, { items = [], pandangan = {}, updates = [], pengendali = {}, relasi = {}, verified = {} } = {}) {
  if (!u) return null
  const t = u.ticker
  const take = newsTake(u, { items, pandangan })
  const laporan = isReport(u), rutin = laporan && RUTIN_RX.test(u.title || '')
  const jenis = (UTYPES.find(x => x.id === u.type) || { name: 'Lainnya' }).name
  const poin = String(u.points || '').split(' · ').map(z => z.trim().replace(/\.$/, '')).filter(Boolean)
  const inti = intiOf(u.summary)

  // Dampak: arah mayoritas poin tafsiran (positif/negatif bagi pemegang saham publik); berimbang = Netral.
  let arah = take.arah.cls === 'good' ? 1 : take.arah.cls === 'bad' ? -1 : 0
  const alasan = take.detail.all.map(x => ({ teks: x.text, nada: x.tone }))

  // Kaitan dengan tesis analisa kurasi (bila emiten sudah dianalisa).
  const pa = pandangan[t] || null
  const it = items.find(x => x.ticker === t) || null
  const harga = it?.price ?? null
  let tesis = null
  if (pa) {
    const nw = pa.nilaiWajar
    const posisi = harga == null || !nw ? ''
      : harga > nw.atas ? `Harga ${rp(harga)} di atas rentang nilai wajar ${rp(nw.bawah)}–${rp(nw.atas)}.`
      : harga < nw.bawah ? `Harga ${rp(harga)} di bawah rentang nilai wajar ${rp(nw.bawah)}–${rp(nw.atas)}.`
      : `Harga ${rp(harga)} di dalam rentang nilai wajar ${rp(nw.bawah)}–${rp(nw.atas)}.`
    tesis = { sikap: pa.sikap || '', ringkas: pa.ringkas || '', asOf: pa.asOf || '', hargaAsOf: tglHargaAcuan(pa), hargaAcuan: pa.hargaAcuan ?? null, harga, posisi,
      baru: !!pa.asOf && day(u) > String(pa.asOf).slice(0, 10) }
  }

  const sisi = duaSisi(u, { tesis, rutin })
  // Label dampak mengikuti keseimbangan faktor positif vs negatif dari isi dokumen (bila ada).
  if (sisi.positif.length || sisi.negatif.length) arah = Math.sign(sisi.positif.length - sisi.negatif.length)
  if (sisi.netral) arah = 0
  // Rangkaian keterbukaan material sebelumnya (maks. 5, 90 hari) sebagai konteks.
  const batas = new Date(Date.parse(day(u)) - 90 * 864e5).toISOString().slice(0, 10)
  const riwayat = laporanMaterial(updates, t).filter(x => x.id !== u.id && day(x) <= day(u) && day(x) >= batas).slice(0, 5)
    .map(x => ({ tanggal: day(x), judul: x.title, inti: intiOf(x.summary) }))

  // Implikasi: pergerakan harga sejak analisa, keseimbangan faktor, dan apakah dokumen menyentuh variabel kunci tesis.
  const implikasi = []
  if (tesis?.hargaAcuan && harga != null) {
    const g = (harga / tesis.hargaAcuan - 1) * 100
    implikasi.push(`Sejak harga acuan analisa ${tesis.hargaAsOf} harga bergerak ${g > 0 ? '+' : ''}${g.toFixed(1).replace('.', ',')}% (${rp(tesis.hargaAcuan)} ke ${rp(harga)}).`)
  }
  if (!rutin) {
    const np = sisi.positif.length, nn = sisi.negatif.length
    implikasi.push(`Isi dokumen memuat ${np} faktor positif dan ${nn} faktor negatif; secara isi ${np > nn ? 'condong mendukung' : nn > np ? 'condong menekan' : 'berimbang terhadap'} ${pa ? `tesis ${pa.sikap}` : 'prospek emiten'}.`)
  }
  const kata = s => new Set(String(s).toLowerCase().match(/[a-z]{5,}/g) || [])
  const kd = kata(`${u.title} ${u.summary} ${u.points}`)
  const sentuh = (pa?.variabelKunci || []).filter(v => [...kata(v)].filter(w => kd.has(w)).length >= 2)
  if (pa) implikasi.push(sentuh.length ? `Dokumen menyentuh variabel kunci analisa: ${sentuh[0]}.`
    : 'Dokumen tidak menyentuh variabel kunci analisa, sehingga tesis tetap bergantung pada katalis yang sudah dipantau.')
  if (take.level >= 3) implikasi.push('Sinyal tinggi: dokumen menyangkut kendali, tender, injeksi aset, atau saham baru yang langsung memengaruhi nilai saham.')

  // Tujuannya apa? / Cari tahu / Selidiki: penyelidikan tujuan dari dokumen + data kurasi emiten.
  const ts = selidikBerita(u, { pa, pengendali: pengendali[t], relasi: relasi[t], story: verified[t], riwayat, nama: it?.name || '' })
  const pantau = [take.detail.watch, ...(pa?.variabelKunci || []).slice(0, 3)].filter(Boolean)
  const fakta = faktaAset([u], { n: 6 }).map(f => `${f.l}: ${f.t}`)

  // Kesimpulan satu paragraf, objektif dan berdasar isi dokumen.
  const k = [`${laporan ? 'Keterbukaan resmi' : 'Berita media'} ${t} (${jenis.toLowerCase()}): ${(inti || u.title).replace(/\.?$/, '.')}`]
  k.push(rutin ? 'Dokumen bersifat administratif sehingga tidak mengubah nilai saham.'
    : `Tingkat sinyal ${take.label.toLowerCase()} dengan dampak ${DAMPAK[arah][0].toLowerCase()} bagi pemegang saham publik.`)
  if (tesis) k.push(tesis.baru
    ? `Dokumen ini terbit setelah analisa kurasi ${tesis.asOf}; sikap ${tesis.sikap} ${arah === 0 || rutin ? 'tidak berubah karenanya' : 'perlu ditinjau ulang terhadap fakta baru ini'}.`
    : `Dokumen ini sudah tercakup dalam analisa kurasi ${tesis.asOf} (sikap ${tesis.sikap}).`)

  return {
    ticker: t, tanggal: day(u), judul: u.title, url: u.url || '', sumber: u.source || (laporan ? 'Stockbit Reports' : 'Media'),
    laporan, rutin, jenis, ringkas: bersih(u.summary), inti, poin,
    sinyal: { label: take.label, cls: take.cls, level: take.level, why: take.detail.levelWhy },
    dampak: { label: rutin ? 'Netral' : DAMPAK[arah][0], cls: rutin ? 'calm' : DAMPAK[arah][1], alasan, ...sisi },
    nominal: take.nominalText, fakta, tesis, pantau, riwayat, implikasi, ...ts, salahBila: pa?.tesisSalahBila || [], kesimpulan: k.join(' '),
  }
}
