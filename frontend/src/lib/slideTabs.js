// Mode Slide halaman emiten: adegan analisa (lib/videoScript.js, versi lengkap) dikelompokkan per tab, plus
// slide khusus untuk tab Insider Activity dan Intel Pasar yang tidak ada di video. Format adegan sama:
// { id, bab, judul, visual: { type, ... }, lines: [kalimat] }.
import { LABELS, prepare } from './insiderFlow.js'
import { big, fmt, fmtDate } from './domain.js'

// Adegan video per tab (urutan mengikuti alur di dalam tab).
export const TAB_SCENES = {
  ringkasan: ['buka', 'tesis', 'rekomendasi', 'penutup'],
  profil: ['profilp', 'pengurus'],
  story: ['pengendali', 'profil', 'transformasi', 'progres'],
  berita: ['berita', 'penjelasan-bursa'],
  analisa: ['skor', 'kasus', 'aset', 'rencana-korporasi', 'valuasi', 'ri', 'ri-kewajaran', 'ri-penilaian', 'ri-bisnis', 'ri-simulasi', 'ri-valuasi', 'ri-kelayakan'],
  teknikal: ['teknikal', 'rencana'],
  spekulasi: ['skenario', 'tindakan'],
}
// Tab yang punya mode Slide (Video dan Download sudah berbentuk ringkasan sendiri).
export const SLIDE_TABS = ['ringkasan', 'profil', 'story', 'aset', 'insider', 'berita', 'analisa', 'teknikal', 'spekulasi', 'intel']

export const scenesFor = (tab, all) => (TAB_SCENES[tab] || []).map(id => all.find(s => s.id === id)).filter(Boolean)

// Insider Activity: jenis perpindahan kepemilikan dan pemegang dengan perubahan terbesar (data /api/insider-rows).
export function insiderScenes(rows, t) {
  const r = prepare(rows || [])
  if (!r.length) return [{ id: 'insider-kosong', bab: 'Insider Activity', judul: `Belum ada keterbukaan pemegang saham ${t}`, visual: { type: 'list', items: ['Tidak ada data IDX/KSEI untuk emiten ini.'] }, lines: [] }]
  const c = {}
  for (const x of r) for (const l of x.labels) c[l] = (c[l] || 0) + 1
  const jenis = Object.keys(LABELS).filter(k => c[k]).map(k => ({ label: LABELS[k].text, to: c[k] }))
  const max = Math.max(...jenis.map(x => x.to), 1)
  const last = r[0], first = r[r.length - 1]
  // Perubahan bersih per pemegang selama rentang data.
  const m = new Map()
  for (const x of [...r].reverse()) {
    const g = m.get(x.name) || { name: x.name, from: x.prevUnknown ? x.cur : +x.prev || 0, to: +x.cur || 0 }
    g.to = +x.cur || 0; m.set(x.name, g)
  }
  const movers = [...m.values()].map(g => ({ ...g, d: g.to - g.from })).filter(g => Math.abs(g.d) >= 0.01).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 6)
  const pct = v => fmt(v, 2) + '%'
  const S = [{
    id: 'insider-jenis', bab: 'Insider Activity', judul: 'Jenis perpindahan kepemilikan',
    visual: jenis.length ? { type: 'bars', items: jenis, max, unit: '' } : { type: 'kpis', items: [[String(r.length), 'keterbukaan'], [fmtDate(first.date), 'data sejak'], [fmtDate(last.date), 'terakhir']] },
    lines: [
      `${r.length} keterbukaan pemegang saham tercatat sejak ${fmtDate(first.date)}; terakhir ${fmtDate(last.date)}.`,
      jenis.length ? `Jenis terbanyak: ${jenis.slice().sort((a, b) => b.to - a.to).slice(0, 3).map(x => `${x.label} (${x.to})`).join(', ')}.` : null,
      ...Object.keys(LABELS).filter(k => c[k]).slice(0, 4).map(k => `${LABELS[k].text}: ${LABELS[k].why}`),
    ].filter(Boolean),
  }]
  if (movers.length) S.push({
    id: 'insider-pemegang', bab: 'Insider Activity', judul: 'Perubahan kepemilikan terbesar',
    visual: { type: 'bars', items: movers.map(g => ({ label: g.name, from: g.from, to: g.to })), max: Math.max(...movers.map(g => Math.max(g.from, g.to)), 1), unit: '%' },
    lines: movers.map(g => `${g.name}: ${pct(g.from)} → ${pct(g.to)} (${g.d > 0 ? '+' : '−'}${fmt(Math.abs(g.d), 2)} poin).`),
  })
  return S
}

// Intel Pasar: ringkasan data tradersaham.com (/api/tsa/summary).
const REG = { ACCUMULATION: 'akumulasi', ACCUM: 'akumulasi', MILD_ACCUMULATION: 'akumulasi ringan', FLIP_BUY: 'berbalik beli',
  DISTRIBUTION: 'distribusi', DIST: 'distribusi', MILD_DISTRIBUTION: 'distribusi ringan', FLIP_SELL: 'berbalik jual', NEUTRAL: 'netral' }
const rpNet = v => v == null ? '–' : (v < 0 ? '−' : '+') + big(Math.abs(v))
export function intelScenes(data, t) {
  if (!data || !data.ada) return [{ id: 'intel-kosong', bab: 'Intel Pasar', judul: `Data intel pasar ${t} belum tersedia`, visual: { type: 'list', items: ['Sumber tradersaham.com belum memiliki data untuk emiten ini.'] }, lines: [] }]
  const sig = data.signals || {}, gems = data.gems || {}, ff = data.foreignFlow || {}, bs = data.brokerScanner || {}
  const reg = REG[sig.regimeSignal] || sig.regimeSignal || '–'
  const S = [{
    id: 'intel-broker', bab: 'Intel Pasar', judul: `Arah broker dominan: ${reg}`,
    visual: { type: 'kpis', items: [
      [reg, 'arah broker dominan'],
      [sig.netAccumulationScore != null ? fmt(sig.netAccumulationScore, 0) : '–', 'skor akumulasi bersih'],
      [rpNet(sig.foreignNetVal), 'arus asing bersih'],
      [sig.rsi != null ? fmt(sig.rsi, 0) : '–', 'RSI'],
    ] },
    lines: [
      sig.dominantAccumBroker ? `Broker akumulasi dominan ${sig.dominantAccumBroker}${sig.dominantAccumShare != null ? ` (${fmt(sig.dominantAccumShare, 1)}% porsi)` : ''}.` : null,
      sig.emaTrend ? `Tren EMA: ${sig.emaTrend}.` : null,
      sig.priceChangePct != null ? `Perubahan harga ${fmt(sig.priceChangePct, 2)}%${sig.closePrice ? ` ke Rp${fmt(sig.closePrice, 0)}` : ''}.` : null,
      sig.liquidityTier ? `Tingkat likuiditas: ${sig.liquidityTier}.` : null,
    ].filter(Boolean),
  }]
  const flows = [['Bandar', bs.bandarNet], ['Smart money', bs.smartMoneyNet], ['Whale', bs.whaleNet], ['Retail', bs.retailNet], ['Campuran', bs.mixedNet]].filter(([, v]) => v != null)
  if (flows.length) S.push({
    id: 'intel-arus', bab: 'Intel Pasar', judul: 'Arus dana per kelompok pelaku',
    visual: { type: 'kpis', items: flows.slice(0, 4).map(([l, v]) => [rpNet(v), l]) },
    lines: [
      ...flows.map(([l, v]) => `${l}: ${v < 0 ? 'jual bersih' : 'beli bersih'} ${big(Math.abs(v))}.`),
      ff.net_value != null ? `Arus asing ${ff.days || ''} hari: ${rpNet(ff.net_value)}${ff.streak ? `, beruntun ${ff.streak} hari` : ''}.` : null,
    ].filter(Boolean),
  })
  if (gems.gemScore != null) S.push({
    id: 'intel-gems', bab: 'Intel Pasar', judul: `Skor gems ${fmt(gems.gemScore, 0)}${gems.gemTier ? ` (${gems.gemTier})` : ''}`,
    visual: { type: 'kpis', items: [[fmt(gems.gemScore, 0), 'skor gems'], [gems.accumScore != null ? fmt(gems.accumScore, 0) : '–', 'skor akumulasi'], [gems.regimeStreakDays != null ? `${gems.regimeStreakDays} hari` : '–', 'rezim berlangsung']] },
    lines: [...(gems.evidence || []).slice(0, 4).map(String), data.meta?.tanggal_data ? `Data per ${fmtDate(data.meta.tanggal_data)}.` : null].filter(Boolean),
  })
  return S
}

// Aset: riset aset lintas sumber (aset-riset.json) + transaksi & KJPP (aset-verified.json) + fakta laporan terakhir.
const cut = (s, n = 70) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s }
// Pecah per kalimat tanpa memotong singkatan (No., Tbk., Pte., Ltd., dll.) maupun angka setelah titik.
const kalimat = t => String(t || '').split(/(?<!\b(?:No|Tbk|Pte|Ltd|PT|Kec|Kab|Jl|dr|Dr|Sdn|Bhd|Co|Inc|vs|dkk|mis))[.;]\s+(?=[A-Z])/)
  .map(x => x.trim().replace(/[.;]?$/, '.')).filter(x => x.length > 15)
export function asetScenes(t, { riset, aset, fakta = [] } = {}) {
  const rs = riset || null, av = aset || null, a = av?.aset || {}, k = av?.kjpp || {}
  if (!rs && !av) return [{ id: 'aset-kosong', bab: 'Aset', judul: `Data aset ${t} belum tersedia`, visual: { type: 'list', items: ['Belum ada aset injeksi yang tercatat untuk emiten ini.'] }, lines: [] }]
  const KJ = { terbit: 'terbit', ditunjuk: 'ditunjuk', belum: 'belum ada' }
  const S = [{
    id: 'aset-ringkas', bab: 'Aset', judul: cut(a.nama || 'Aset yang diinjeksi', 90),
    visual: { type: 'kpis', items: [
      [av?.transaksi?.nilaiRp ? big(av.transaksi.nilaiRp) : 'belum ada', 'nilai transaksi'],
      [cut(String(a.porsi || '–').split(/[(;]/)[0].trim(), 24), 'porsi'],
      [KJ[k.status] || (k.nilaiRp ? 'terbit' : 'belum ada'), 'penilaian KJPP'],
      [String((rs?.sumber || []).length), 'sumber riset'],
    ] },
    lines: kalimat(rs?.ringkasan || a.deskripsi),
  }]
  if (fakta.length) S.push({ id: 'aset-laporan', bab: 'Aset', judul: 'Fakta aset dari laporan terakhir',
    visual: { type: 'list', items: fakta.slice(0, 5).map(f => `${fmtDate(f.d)} · ${cut(f.t, 110)}`) }, lines: fakta.map(f => `${f.l} (${fmtDate(f.d)}): ${f.t}.`) })
  if (rs?.entitas?.length) S.push({ id: 'aset-entitas', bab: 'Aset', judul: 'Entitas aset',
    visual: { type: 'list', items: rs.entitas.slice(0, 5).map(e => `${cut(e.nama, 60)} · ${cut(e.peran, 50)}`) },
    lines: rs.entitas.map(e => [e.nama, e.lokasi && `lokasi ${e.lokasi}`, e.kegiatan].filter(Boolean).join('; ') + '.') })
  if (rs?.operasional?.length) S.push({ id: 'aset-operasional', bab: 'Aset', judul: 'Operasional',
    visual: { type: 'list', items: rs.operasional.slice(0, 5).map(o => `${o.l}: ${cut(o.t, 90)}`) },
    lines: rs.operasional.map(o => `${o.l}: ${o.t}.`) })
  const tb = rs?.tambang
  if (tb) S.push({ id: 'aset-tambang', bab: 'Aset', judul: `Tambang${tb.komoditas ? ' ' + cut(tb.komoditas, 30) : ''}: cadangan dan umur`,
    visual: { type: 'kpis', items: [[cut(tb.cadangan || '–', 26), 'cadangan'], [cut(tb.umur || '–', 26), 'umur tambang'], [cut(tb.produksi || '–', 26), 'produksi'], [cut(tb.kualitas || '–', 26), 'kualitas']] },
    lines: [['Lokasi', tb.lokasi], ['Izin', tb.izin], ['Luas', tb.luas], ['Cadangan', tb.cadangan], ['Sumber daya', tb.sumberDaya], ['Standar', tb.standar],
      ['Kualitas', tb.kualitas], ['Produksi', tb.produksi], ['Umur', tb.umur], ['Stripping ratio', tb.stripRatio], ['Infrastruktur', tb.infrastruktur]].filter(x => x[1]).map(([l, v]) => `${l}: ${v}.`) })
  if (rs?.keuangan?.length) S.push({ id: 'aset-keuangan', bab: 'Aset', judul: 'Keuangan dan nilai aset',
    visual: { type: 'list', items: rs.keuangan.slice(0, 5).map(o => `${o.l}: ${cut(o.t, 90)}`) }, lines: rs.keuangan.map(o => `${o.l}: ${o.t}.`) })
  if (k.status || k.nama) S.push({ id: 'aset-kjpp', bab: 'Aset', judul: `Penilaian KJPP: ${KJ[k.status] || 'belum ada'}`,
    visual: { type: 'kpis', items: [[cut(k.nama || 'belum ada', 26), 'KJPP'], [k.nilaiRp ? big(k.nilaiRp) : cut(k.nilai || 'belum ada', 20), 'nilai'], [k.tanggalLaporan ? fmtDate(k.tanggalLaporan) : '–', 'tanggal laporan']] },
    lines: [k.metode && `Metode: ${k.metode}.`, k.kesimpulan && `Kesimpulan: ${k.kesimpulan}.`, k.dasar, 'Simulasi nilai KJPP otomatis tersedia di versi lengkap.'].filter(Boolean) })
  if (rs?.pengendaliAset?.length) S.push({ id: 'aset-pengendali', bab: 'Aset', judul: 'Aset lain milik pengendali',
    visual: { type: 'list', items: rs.pengendaliAset.slice(0, 5).map(e => `${cut(e.nama, 55)}${e.jenis ? ' · ' + cut(e.jenis, 35) : ''}`) },
    lines: rs.pengendaliAset.map(e => [e.nama, e.lokasi, e.detail, e.hubungan && `kaitan: ${e.hubungan}`].filter(Boolean).join('; ') + '.') })
  if (rs?.positif?.length || rs?.risiko?.length) S.push({ id: 'aset-pr', bab: 'Aset', judul: 'Pendukung dan risiko aset',
    visual: { type: 'list', items: [...(rs.positif || []).slice(0, 2).map(x => '+ ' + cut(x, 100)), ...(rs.risiko || []).slice(0, 3).map(x => '! ' + cut(x, 100))] },
    lines: [...(rs.positif || []).map(x => 'Pendukung: ' + x), ...(rs.risiko || []).map(x => 'Risiko: ' + x)] })
  if (rs?.belumDitemukan?.length) S.push({ id: 'aset-celah', bab: 'Aset', judul: 'Data yang belum diungkap',
    visual: { type: 'list', items: rs.belumDitemukan.slice(0, 5).map(x => cut(x, 100)) }, lines: rs.belumDitemukan })
  return S
}
