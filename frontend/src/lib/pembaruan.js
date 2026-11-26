// Pembaruan otomatis dari laporan Stockbit (disinkronkan server tiap 2 jam ke store.updates, termasuk poin kunci):
// - laporanBaru: laporan material yang lebih baru dari tanggal analisa/riset kurasi, agar tidak ada yang tertinggal;
// - faktaAset: poin kunci yang memuat fakta aset (akuisisi, luas, kolam, cadangan, kapasitas, izin, KJPP, nilai).

// Laporan rutin/administratif yang tidak mengubah tesis.
export const RUTIN_RX = /registrasi pemegang|bukti iklan|pemanggilan rapat|pemberitahuan rencana rapat|penggunaan dana hasil|laporan bulanan|penyampaian bukti|perubahan alamat|jadwal|daftar pemegang saham|public expose.*bukti|pencatatan saham/i
const BUKAN_ASET = /remunerasi|dividen|komisaris|direktur|direksi|kuorum|rups|iklan|pemanggilan|volatilitas|tidak mengetahui informasi|harga saham|dana cadangan|sumber daya manusia|komite|rugi (bersih|konsolidasi)|laba bersih|obligasi|\bowk\b|plafon pinjaman/i
// Urutan menentukan kategori: akuisisi didahulukan agar "akuisisi saham PMA tambak" tidak tercatat sebagai kolam.
const FAKTA = [
  ['Akuisisi / kepemilikan', /akuisisi|pengambilalihan|mengakuisisi|\b\d[\d.,]*\s*%\s*saham|inbreng|cspa|ppjb/i],
  ['Luas lahan / konsesi', /\b(\d[\d.,]*)\s*(ha|hektare|hektar|m2|m²|km2)\b|\bluas\b/i],
  ['Kolam / unit produksi', /\bkolam\b/i],
  ['Cadangan / sumber daya', /cadangan|sumber daya|jorc|kcmi/i],
  ['Kapasitas / produksi', /kapasitas|produksi|\b\d[\d.,]*\s*(ton|mw|mmscfd|liter|unit|kwh|tbps|homepass)\b/i],
  ['Izin / konsesi', /\biup\b|iujp|konsesi|izin usaha|perizinan/i],
  ['Penilaian KJPP', /kjpp|penilai|valuasi independen|appraisal/i],
  ['Nilai transaksi / pendanaan', /(nilai|senilai|sebesar|transaksi|pinjaman|rights issue|hmetd|penambahan modal)[^.]*\b(rp|usd|us\$|sgd)\s?\d/i],
]

const isReport = u => /^sb-report-/.test(String(u.id || ''))
const pts = u => String(u.points || '').split(' · ').map(z => z.trim().replace(/\.$/, '')).filter(Boolean)
const day = u => String(u.date || '').slice(0, 10)

// Laporan Stockbit satu emiten, terbaru dulu, tanpa laporan rutin.
export function laporanMaterial(updates, ticker) {
  return (updates || []).filter(u => u.ticker === ticker && isReport(u) && !RUTIN_RX.test(u.title || ''))
    .sort((a, b) => day(b).localeCompare(day(a)))
}

// Tanggal acuan data kurasi emiten: analisa (pandangan-analis asOf) dan riset aset (aset-riset asOf).
export function acuanKurasi(ticker, { pandangan = {}, riset = {} } = {}) {
  const list = [['analisa', pandangan[ticker]?.asOf], ['riset aset', riset[ticker]?.asOf]].filter(x => x[1])
  if (!list.length) return null
  // Acuan = tanggal kurasi paling lama (data yang paling mungkin tertinggal).
  return list.sort((a, b) => String(a[1]).localeCompare(String(b[1])))[0]
}

// Laporan material yang terbit setelah tanggal acuan kurasi.
export function laporanBaru(updates, ticker, ctx = {}) {
  const ac = acuanKurasi(ticker, ctx)
  if (!ac) return null
  const items = laporanMaterial(updates, ticker).filter(u => day(u) > String(ac[1]).slice(0, 10))
    .map(u => ({ date: day(u), title: u.title, url: u.url, points: pts(u), summary: String(u.summary || '').replace(/\s*\(Ringkasan AI Stockbit\)\s*$/, '') }))
  return items.length ? { jenis: ac[0], sejak: String(ac[1]).slice(0, 10), items } : null
}

// Fakta aset terukur dari poin kunci laporan (maks. n baris, tanpa duplikat).
export function faktaAset(reports, { asOf = '', n = 10 } = {}) {
  const out = [], seen = new Set()
  for (const x of reports || []) {
    if (RUTIN_RX.test(x.title || '')) continue
    for (const pt of pts(x)) {
      if (BUKAN_ASET.test(pt)) continue
      const f = FAKTA.find(([, rx]) => rx.test(pt))
      if (!f) continue
      const key = pt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ l: f[0], t: pt, d: day(x), url: x.url, judul: x.title, baru: !!asOf && day(x) > asOf })
    }
    if (out.length >= n) break
  }
  return out.slice(0, n)
}
