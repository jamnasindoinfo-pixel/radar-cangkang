// Konstanta bisnis & util murni (port dari website/js/lib/domain.js, tanpa DOM).

// Tahapan backdoor listing yang lazim di BEI, berurutan.
export const STAGES = [
  { id: 'radar',   name: 'Penyaringan',          hint: 'Sebelum pengumuman: kabar pasar, anomali volume' },
  { id: 'spa',     short: 'PPJB',    name: 'Penandatanganan PPJB', hint: 'Keterbukaan informasi PPJB bersyarat atas saham pengendali' },
  { id: 'tender',  short: 'PTW',     name: 'Penyelesaian & PTW',   hint: 'Perubahan pengendalian efektif; penawaran tender wajib ke publik' },
  { id: 'rupslb',  short: 'RUPSLB',  name: 'RUPSLB',               hint: 'Persetujuan perubahan KBLI, nama, pengurus, anggaran dasar' },
  { id: 'injeksi', short: 'Injeksi', name: 'Injeksi aset',         hint: 'PMHMETD/PMTHMETD, inbreng aset ke perseroan' },
  { id: 'selesai', short: 'Pasca',   name: 'Pascatransaksi',       hint: 'Usaha baru terkonsolidasi dalam laporan keuangan' },
]

export const num = v => (v === '' || v === null || v === undefined || isNaN(+v)) ? null : +v

// Bobot faktor penyaringan; total 100. `auto` dihitung dari data pasar.
export const SIGNALS = [
  { id: 'akuisisi', short: 'Perubahan pengendalian', label: 'Perubahan pengendalian / PPJB bersyarat diumumkan', w: 25 },
  { id: 'kbli',     short: 'Perubahan usaha',        label: 'Perubahan kegiatan usaha (KBLI) atau nama perseroan', w: 15 },
  { id: 'rights',   short: 'Rencana dilusi',         label: 'Rencana PMHMETD / PMTHMETD berskala besar', w: 15 },
  { id: 'cangkang', short: 'Profil cangkang',        label: 'Profil cangkang: pendapatan minim, merugi, atau defisiensi modal', w: 10 },
  { id: 'direksi',  short: 'Rombak pengurus',        label: 'Perombakan direksi/komisaris di luar siklus RUPST', w: 5 },
  { id: 'uma',      short: 'UMA/suspensi',           label: 'UMA atau penghentian sementara perdagangan oleh BEI', w: 5 },
  { id: 'volume',   short: 'Anomali volume',         label: 'Anomali volume tanpa katalis publik', w: 5 },
  { id: 'smallcap', short: 'Kapitalisasi mikro',     label: 'Kapitalisasi mikro: kapitalisasi pasar < Rp500 miliar', w: 10, auto: d => num(d.mcap) !== null && num(d.mcap) < 500 },
  { id: 'lowprice', short: 'Harga rendah',           label: 'Saham berharga rendah: harga ≤ Rp100', w: 10, auto: d => num(d.price) !== null && num(d.price) <= 100 },
]

// Tonggak transaksi pengambilalihan, berurutan; bobot total 100 = transaksi tuntas.
export const MILESTONES = [
  { id: 'spa',       label: 'Penandatanganan PPJB bersyarat', w: 10 },
  { id: 'akuisisi',  label: 'Penyelesaian transaksi: perubahan pengendalian efektif', w: 15 },
  { id: 'to_umum',   label: 'Pernyataan penawaran tender wajib diumumkan', w: 10 },
  { id: 'to_selesai',label: 'Penawaran tender wajib selesai dan dibayar', w: 10 },
  { id: 'rupslb',    label: 'RUPSLB menyetujui perubahan usaha, nama, dan pengurus', w: 15 },
  { id: 'rights',    label: 'PMHMETD/PMTHMETD berjalan (prospektus, pernyataan efektif, atau hasil pelaksanaan)', w: 10 },
  // Nilai injeksi baru pasti setelah penilai independen (KJPP) menerbitkan laporan.
  { id: 'kjpp',      label: 'Laporan penilaian KJPP atas aset injeksi terbit', w: 10 },
  { id: 'inbreng',   label: 'Injeksi aset efektif (inbreng/akuisisi entitas anak)', w: 10 },
  { id: 'bisnis',    label: 'Usaha baru terkonsolidasi dalam laporan keuangan', w: 10 },
]
const TAKEOVER_MS = ['spa', 'akuisisi', 'to_umum', 'to_selesai']
// Perkiraan bila milestone belum diisi: posisi awal tiap tahap.
export const STAGE_PCT = { radar: 0, spa: 10, tender: 35, rupslb: 50, injeksi: 65, selesai: 100 }

export const UTYPES = [
  { id: 'pengendali', name: 'Pengendalian & akuisisi' },
  { id: 'tender',     name: 'Penawaran tender wajib' },
  { id: 'rupslb',     name: 'RUPSLB' },
  { id: 'rights',     name: 'Penambahan modal/injeksi aset' },
  { id: 'uma',        name: 'UMA/suspensi' },
  { id: 'regulasi',   name: 'Regulasi & pasar' },
  { id: 'lainnya',    name: 'Lainnya' },
]

// Tahap = tahap dari tonggak terjauh yang sudah tercapai. Tanpa tonggak, pakai tahap yang dipilih manual.
export const MS_STAGE = [['bisnis', 'selesai'], ['inbreng', 'injeksi'], ['kjpp', 'injeksi'], ['rights', 'injeksi'], ['rupslb', 'rupslb'],
  ['to_selesai', 'tender'], ['to_umum', 'tender'], ['akuisisi', 'tender'], ['spa', 'spa']]
export const stageFromMs = ms => (MS_STAGE.find(([m]) => (ms || {})[m]) || [])[1]
export const stageOf = d => stageFromMs(d.ms) || d.stage || 'radar'
// Tanggal harga acuan pandangan analis: hargaAsOf bila analisa diperbarui dari laporan baru tanpa menghitung ulang harga.
export const tglHargaAcuan = pa => pa?.hargaAsOf || pa?.asOf || ''

// Akuisisi strategis tanpa rencana injeksi (story terverifikasi: tanpa injectType, usaha "Tetap ...").
const noInjectOf = v => !!v && !v.injectType && /^Tetap/i.test(v.baru || '')

// Data terverifikasi opsional: aset = aset-verified.json, verified = story-verified.json (peta per kode).
// - KJPP dihitung bila laporan penilaian berstatus "terbit" (bukan sekadar ditunjuk);
// - injeksi yang terverifikasi tereksekusi sudah pasti lewat KJPP dan inbreng;
// - tanpa rencana injeksi, persen dihitung dari tahapan pengambilalihan saja (PPJB s.d. PTW selesai).
export function progressOf(d, { aset = {}, verified = {} } = {}) {
  const ms = { ...(d.ms || {}) }, v = verified[d.ticker]
  if (!ms.kjpp && aset[d.ticker]?.kjpp?.status === 'terbit') ms.kjpp = true
  if (v?.executed) { ms.kjpp = true; ms.inbreng = true }
  const noInject = noInjectOf(v)
  const applicable = noInject ? MILESTONES.filter(m => TAKEOVER_MS.includes(m.id)) : MILESTONES
  const done = applicable.filter(m => ms[m.id])
  const next = applicable.find(m => !ms[m.id]) || null
  // auto = tanggal deteksi otomatis per tahapan (msAuto), untuk rincian asal data.
  const base = { ms, noInject, applicable, auto: d.msAuto || {} }
  if (!done.length) return { ...base, pct: STAGE_PCT[stageOf(d)] ?? 0, est: true, next: null }
  const total = applicable.reduce((s, m) => s + m.w, 0)
  return { ...base, pct: Math.round(done.reduce((s, m) => s + m.w, 0) / total * 100), est: false, next }
}

// Potensi harga dari level emiten sendiri: naik = kembali ke puncak siklus, turun = ke harga PTW.
// ratio = naik ÷ |turun| (hanya bila PTW di bawah harga kini); runupPeak = puncak ÷ harga pra-rumor.
export function potensiOf({ price, peak, ptw, base }) {
  const up = peak && price ? peak / price - 1 : null
  const down = ptw && price ? ptw / price - 1 : null
  return { up, down, ratio: up != null && down != null && down < 0 ? up / -down : null, runupPeak: base && peak ? peak / base : null }
}

export const scoreOf = d => SIGNALS.reduce((s, sig) => s + ((sig.auto ? sig.auto(d) : (d.flags || {})[sig.id]) ? sig.w : 0), 0)
export const statusOf = s => s >= 65 ? 'strong' : s >= 35 ? 'warn' : 'calm'
export const STATUS_LABEL = { strong: 'Keyakinan tinggi', warn: 'Daftar pantau', calm: 'Pemantauan' }

// Status transaksi. "Selesai" hanya bila tujuan akhirnya tercapai:
// injeksi tereksekusi (terverifikasi, atau inbreng + RUPSLB + PTW tuntas), usaha baru terkonsolidasi,
// atau akuisisi strategis tanpa rencana injeksi dengan PTW tuntas. PTW dibayar saja belum selesai.
export function dealOf(d, p, { verified = {} } = {}) {
  p = p || progressOf(d, { verified })
  const ms = p.ms || d.ms || {}, v = verified[d.ticker]
  if (p.pct === 100 || ms.bisnis || stageOf(d) === 'selesai') return 'selesai'
  if (v?.executed || (ms.inbreng && ms.rupslb && ms.to_selesai)) return 'selesai'
  if (noInjectOf(v) && ms.to_selesai) return 'selesai'
  return 'proses'
}

// Kolom Posisi & Selanjutnya: tahapan terakhir yang tercapai dan langkah berikutnya (+ target bila ada).
export function posisiOf(d, p, { verified = {} } = {}) {
  p = p || progressOf(d, { verified })
  const ms = p.ms || d.ms || {}, v = verified[d.ticker]
  const last = MILESTONES.filter(m => ms[m.id]).pop()
  const now = !last ? 'Belum ada tahapan terverifikasi'
    : noInjectOf(v) && ms.to_selesai ? 'Akuisisi strategis tuntas, tanpa rencana injeksi'
    : `${MS_SHORT[last.id]} tercapai`
  let next = ''
  if (dealOf(d, p, { verified }) !== 'selesai') {
    // KJPP hanya relevan bila ada rencana injeksi aset.
    const nm = MILESTONES.find(m => !ms[m.id] && !(m.id === 'kjpp' && !v?.injectType))
    if (nm) next = nm.label
    const tgt = v?.target || (d.tender?.end && !ms.to_selesai ? 'PTW s.d. ' + fmtDate(d.tender.end.slice(0, 10)) : '')
    // Klausa pertama target; bila panjang, tanpa keterangan dalam kurung (tidak dipotong di tengah kata).
    const t1 = String(tgt).split(/[.;]/)[0].trim()
    if (tgt) next += (next ? ' · target: ' : '') + (t1.length <= 90 ? t1 : t1.replace(/\s*\(.*$/, ''))
  }
  return { now, next }
}

// Trek 5 ruas (tanpa "radar"); radar → -1.
export const STAGE_TRACK = ['spa', 'tender', 'rupslb', 'injeksi', 'selesai']
// Posisi di trek 5 ruas. Dengan `ctx` (aset, verified), transaksi yang sudah tuntas
// (mis. executed di story-verified) masuk ruas Selesai walau tonggak item belum lengkap.
export function trackIndex(d, ctx) {
  if (ctx && dealOf(d, progressOf(d, ctx), ctx) === 'selesai') return STAGE_TRACK.length - 1
  return STAGE_TRACK.indexOf(stageOf(d))
}

// Selisih harga terhadap rentang nilai wajar, persen bulat: >0 di atas hi, <0 di bawah lo, 0 di dalam.
export function fairGap(price, lo, hi) {
  if (price == null || lo == null || hi == null) return null
  if (price > hi) return Math.round((price / hi - 1) * 100)
  if (price < lo) return Math.round((price / lo - 1) * 100)
  return 0
}

export const fmt = (v, d = 0) => v === null ? '–' : v.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d })
export const fmtDate = s => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? (s || '') : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }
export const rp = v => v == null ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
export const big = v => v == null ? '–' : v >= 1e12 ? `Rp${(v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T` : `Rp${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
export const x2 = v => v == null ? '–' : v.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '×'
// Selisih persen sebagai teks ("+12%", "-3,4%"); satu desimal bila di bawah 10%. Warna naik/turun ditentukan komponen dari tanda.
export const pctTxt = (to, from) => {
  if (to == null || !from) return '–'
  const p = (to / from - 1) * 100
  const s = Math.abs(p) < 10 ? p.toFixed(1).replace('.', ',') : p.toFixed(0)
  return `${p >= 0 ? '+' : ''}${s}%`
}

// Sesi perdagangan BEI (jam lokal; hari libur bursa tidak dihitung).
export function sessionLabel(now = new Date()) {
  const day = now.getDay(), m = now.getHours() * 60 + now.getMinutes(), fri = day === 5
  if (day === 0 || day === 6) return 'bursa libur'
  if (m < 540) return 'sebelum pembukaan'
  if (m < (fri ? 690 : 720)) return 'sesi I'
  if (m < (fri ? 840 : 810)) return 'istirahat'
  if (m < 950) return 'sesi II'
  return 'bursa tutup'
}

// Jadwal: sumbu 120 hari ke belakang s.d. 60 hari ke depan; tlX → posisi persen atau null bila di luar sumbu.
export const TL_PAST = 120, TL_FUT = 60, TL_TODAY = (TL_PAST / (TL_PAST + TL_FUT) * 100).toFixed(2)
export const MS_SHORT = { spa: 'PPJB', akuisisi: 'Kendali', to_umum: 'PTW', to_selesai: 'PTW selesai', rupslb: 'RUPSLB', rights: 'HMETD', kjpp: 'KJPP', inbreng: 'Inbreng', bisnis: 'Usaha baru' }
export const tlX = iso => {
  const days = (new Date(iso + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5
  return days < -TL_PAST || days > TL_FUT ? null : ((days + TL_PAST) / (TL_PAST + TL_FUT) * 100).toFixed(2)
}
export function tlEvents(d) {
  const ev = Object.entries(d.msAuto || {}).filter(([, v]) => /^\d{4}-\d\d-\d\d/.test(v || ''))
    .map(([k, v]) => ({ label: MS_SHORT[k] || k, date: v.slice(0, 10) }))
  if (d.tender?.end) ev.push({ label: 'Akhir PTW', date: d.tender.end.slice(0, 10) })
  if (d.tender?.paydate) ev.push({ label: 'PTW dibayar', date: d.tender.paydate.slice(0, 10) })
  return ev.sort((a, b) => a.date.localeCompare(b.date))
}

// Penanda "baru": laporan yang masuk ke radar setelah tim menandai "sudah dilihat" (seenAt, ISO).
// updatedAt = waktu laporan masuk database; laporan lama tanpa updatedAt dinilai dari tanggalnya
// (tanggal saja, jam tidak diketahui) terhadap tanggal lokal penanda.
const localDay = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export function isNewSince(u, seenAt) {
  if (!u || !seenAt) return false
  if (u.updatedAt) return new Date(u.updatedAt) > new Date(seenAt)
  return !!u.date && u.date.slice(0, 10) > localDay(seenAt)
}

// Warna tag sikap analis; dipakai SikapTag dan Berita supaya sama di semua halaman.
export const SIKAP_CLS = { 'Hindari': 't-strong', 'Spekulatif tinggi': 't-warn', 'Netral': 't-calm', 'Asimetri positif': 't-good' }

// Kelengkapan jawaban emiten atas tiap pertanyaan BEI (ri-dokumen.json → penjelasanBursa.poin[].jawaban):
// ukuran yang dapat dicek langsung di dokumen, terpisah dari pendapat analis (kolom Analisa).
export const PB_JAWABAN = { lengkap: ['Lengkap', 'good'], sebagian: ['Sebagian', 'calm'], tidak: ['Tidak dijawab', 'strong'] }
// Nada objektif per butir (poin[].nada) dan dasarnya (poin[].dasar).
export const PB_NADA = { positif: ['Positif', 'good'], netral: ['Netral', 'calm'], negatif: ['Negatif', 'strong'] }
export const PB_DASAR = { ditunda: 'Tidak dijawab/ditunda', merugikan: 'Fakta merugikan dari emiten', fakta: 'Fakta/kepatuhan', kepastian: 'Menambah kepastian', terbuka: 'Pengungkapan spesifik' }
export const PB_KRITERIA = 'Dasar nada (objektif, dari isi dokumen): Negatif bila pertanyaan BEI tidak dijawab atau ditunda, atau emiten sendiri menyatakan fakta yang merugikan publik; Positif bila jawaban mengungkap data spesifik baru (angka, nama, rincian), memberi kepastian, atau perlindungan bagi publik; Netral untuk fakta, prosedur, atau kepatuhan aturan, termasuk hubungan dan transaksi afiliasi. Kolom Analisa adalah pendapat analis.'
