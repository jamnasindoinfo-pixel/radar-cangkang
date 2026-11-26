// Kelompok untuk kartu "terbaik per kelompok" di tab Kinerja: Konglo, CPO, Backdoor, Tambang, Telekomunikasi
// & kabel. Klasifikasi dari profil Stockbit (x.kelas: sektor/sub/ind IDX-IC) dengan cadangan
// nama & ringkasan laporan bila profil belum diambil. Perbankan dan asuransi selalu dikecualikan.

// Grup konglomerasi besar BEI dan emiten anggotanya (kepemilikan pengendali yang dikenal publik).
export const KONGLO = {
  Salim: ['INDF', 'ICBP', 'SIMP', 'LSIP', 'IMAS', 'DNET', 'META'],
  'Sinar Mas': ['DSSA', 'INKP', 'TKIM', 'SMAR', 'BSDE', 'DUTI', 'SMMA', 'GEMS'],
  Astra: ['ASII', 'UNTR', 'AALI', 'AUTO', 'ASGR'],
  'Barito (Prajogo)': ['BRPT', 'TPIA', 'BREN', 'CUAN', 'PTRO', 'CDIA'],
  Djarum: ['TOWR', 'BELI'],
  Bakrie: ['BUMI', 'BRMS', 'ENRG', 'UNSP', 'DEWA', 'BNBR', 'VKTR'],
  MNC: ['BHIT', 'MNCN', 'BMTR', 'IPTV', 'KPIG', 'MSIN', 'BCAP', 'IATA'],
  Lippo: ['LPKR', 'LPPF', 'SILO', 'MLPL', 'MPPA', 'LPCK', 'LPLI', 'MLPT'],
  Adaro: ['ADRO', 'AADI', 'ADMR'],
  'Merdeka/Saratoga': ['MDKA', 'MBMA', 'EMAS', 'SRTG'],
  Emtek: ['EMTK', 'SCMA', 'BUKA', 'SAME'],
  Triputra: ['TAPG', 'DRMA', 'ASSA'],
  Harita: ['NCKL', 'CITA'],
  Medco: ['MEDC', 'AMMN'],
  Indika: ['INDY'],
  'Haji Isam': ['JARR', 'PGUN'],
  'Happy Hapsoro': ['RAJA', 'RATU'],
  'Agung Sedayu': ['PANI', 'CBDK'],
  Ciputra: ['CTRA'],
  'Gudang Garam': ['GGRM'],
}
// Telekomunikasi & penunjangnya: operator, menara, internet/data center, serta komponen & peralatan kelistrikan
// (kabel) yang memasok jaringan. Ditambah emiten berklasifikasi "Telecommunication" di profil Stockbit.
export const TELKO = new Set([
  'TLKM', 'ISAT', 'EXCL', 'TOWR', 'TBIG', 'MTEL', 'LINK', 'BALI', 'CENT', 'GHON', 'JAST', 'DATA',
  'COIN', 'DOOH', 'DSSA', 'INET', 'IRSX', 'KETR', 'MORA', 'PADA', 'WIFI',
  'CCSI', 'IKBI', 'JECC', 'KBLI', 'KBLM', 'SCCO', 'VOKS',
])
// Emiten sawit/CPO (perkebunan & pengolahan minyak sawit); klasifikasi profil kadang menaruhnya di "Food Products".
export const CPO = new Set([
  'AALI', 'LSIP', 'SIMP', 'SMAR', 'SSMS', 'TAPG', 'DSNG', 'SGRO', 'BWPT', 'PALM', 'ANJT', 'JAWA', 'GZCO', 'UNSP',
  'MAGP', 'PSGO', 'CSRA', 'STAA', 'TBLA', 'NSSS', 'FAPA', 'MGRO', 'TLDN', 'IPPE', 'GOLL', 'PGUN',
])
// Emiten tambang dan komoditasnya (emas, nikel, batu bara, timah, tembaga, bauksit, dll.); satu emiten bisa lebih dari
// satu komoditas (ANTM: emas & nikel).
export const TAMBANG = {
  'Batu bara': ['ADRO', 'AADI', 'ADMR', 'PTBA', 'ITMG', 'BUMI', 'INDY', 'HRUM', 'GEMS', 'BSSR', 'MBAP', 'KKGI', 'DOID',
    'TOBA', 'ABMM', 'BYAN', 'MCOL', 'SMMT', 'ARII', 'GTBO', 'FIRE', 'BOSS', 'COAL', 'DEWA', 'CUAN', 'RMKO', 'MYOH'],
  Nikel: ['INCO', 'ANTM', 'NCKL', 'MBMA', 'NICL', 'NICE', 'DKFT', 'IFSH', 'PURE'],
  Emas: ['ANTM', 'MDKA', 'EMAS', 'ARCI', 'BRMS', 'PSAB', 'SQMI'],
  Tembaga: ['AMMN'],
  Timah: ['TINS'],
  Bauksit: ['CITA'],
  Seng: ['ZINC'],
}
const KOMODITAS = {}
for (const [g, ks] of Object.entries(TAMBANG)) for (const k of ks) (KOMODITAS[k] ||= []).push(g)
export const komoditas = t => (KOMODITAS[t] || []).join(', ')
const punya = (t, ...gs) => (KOMODITAS[t] || []).some(g => gs.includes(g))
const GRUP = Object.fromEntries(Object.entries(KONGLO).flatMap(([g, ks]) => ks.map(k => [k, g])))
export const grupKonglo = t => GRUP[t] || ''

const isiTeks = x => [x.nama, x.judul, x.ringkas, x.pendorong, ...(x.poin || [])].filter(Boolean).join(' ')
// Industri/subsektor profil bila ada; bila belum, teks laporan atau nama sektor (cadangan dari data Seasonality).
const cek = (x, rxKelas, rxTeks) => {
  const k = x.kelas?.ind || x.kelas?.sub
  return k ? rxKelas.test(k) : !!(rxTeks?.test(isiTeks(x)) || rxKelas.test(x.kelas?.sektor || ''))
}

export const bankAsuransi = x => /bank|insurance|asuransi/i.test([x.kelas?.sub, x.kelas?.ind].join(' '))
  || /\b(bank|asuransi|reasuransi|insurance|assurance)\b/i.test(x.nama || '')

// Industri logam & mineral (profil Stockbit berbahasa Indonesia) dengan komoditas disebut di teks laporan.
// Pengolah/pabrikan logam (pelat timah, baja, aluminium) berindustri sama tetapi bukan penambang.
const BUKAN_TAMBANG = new Set(['NIKL', 'ISSP', 'KRAS', 'GDST', 'BTON', 'LION', 'LMSH', 'ALKA', 'ALMI', 'INAI', 'PICO',
  'CTBN', 'JKSW', 'TBMS', 'BAJA', 'GGRP', 'OPMS', 'SMRU'])
const logam = (x, rx) => !BUKAN_TAMBANG.has(x.t) && /logam|mineral|metal/i.test(x.kelas?.ind || x.kelas?.sub || '') && rx.test(isiTeks(x))

export const KELOMPOK = [
  ['konglo', 'Konglo', x => !!grupKonglo(x.t)],
  ['cpo', 'CPO', x => CPO.has(x.t) || cek(x, /perkebunan|plantation|crops/i, /\b(sawit|CPO|TBS|perkebunan|plantation)\b/i)],
  // Hanya backdoor terkonfirmasi (server: tahap PPJB/PTW/dst. + confirmed), bukan saham yang baru bersinyal di radar.
  ['backdoor', 'Backdoor', x => !!x.backdoor],
  ['batubara', 'Tambang · Batu bara', x => punya(x.t, 'Batu bara') || cek(x, /^(batu ?bara|coal)/i, /\b(batu ?bara|coal)\b/i)],
  ['emas', 'Tambang · Emas', x => punya(x.t, 'Emas') || (!komoditas(x.t) && logam(x, /\b(emas|gold)\b/i))],
  ['nikel', 'Tambang · Nikel', x => punya(x.t, 'Nikel') || (!komoditas(x.t) && logam(x, /\b(nikel|nickel|feronikel)\b/i))],
  ['logam', 'Tambang · Tembaga, Timah & lainnya', x => punya(x.t, 'Tembaga', 'Timah', 'Bauksit', 'Seng')
    || (!komoditas(x.t) && logam(x, /\b(tembaga|copper|timah|bauksit|bauxite|alumina|seng|zinc)\b/i))],
  ['telko', 'Telekomunikasi & kabel', x => TELKO.has(x.t) || cek(x, /telekomunikasi|telecom/i, /\b(telekomunikasi|seluler|menara telekomunikasi|fiber optik)\b/i)],
]

// Terbaik per kelompok: `gagal(x)` = daftar syarat yang tidak terpenuhi (kosong = lolos); bukan bank/asuransi;
// PE TTM terendah. Satu emiten hanya menjadi pilihan utama sekali (kelompok di depan didahulukan).
// alt = 2 emiten lolos berikutnya sebagai pembanding; dekat = 2 emiten (PE positif) yang belum lolos dengan syarat
// gagal paling sedikit, beserta alasannya.
export function terbaikPerKelompok(rows, gagal) {
  const dipakai = new Set()
  const pe = r => r.kuartal?.pe
  return KELOMPOK.map(([k, label, cocok]) => {
    const anggota = rows.filter(r => !bankAsuransi(r) && cocok(r)).map(r => ({ r, g: gagal(r) }))
    const lolos = anggota.filter(a => !a.g.length).map(a => a.r).sort((a, b) => pe(a) - pe(b))
    const x = lolos.find(r => !dipakai.has(r.t)) || null
    if (x) dipakai.add(x.t)
    const alt = lolos.filter(r => r !== x).slice(0, 2)
    const dekat = anggota.filter(a => a.g.length && pe(a.r) > 0)
      .sort((a, b) => a.g.length - b.g.length || pe(a.r) - pe(b.r)).slice(0, 2)
    return { k, label, x, alt, dekat }
  })
}

// Sektor IDX-IC (kategori sama dengan stockbit.com/sector, dari profil emiten x.kelas.sektor). SEMUA = gabungan.
export const SEMUA = 'Semua'
export const SEKTOR = ['Barang Konsumen Primer', 'Barang Konsumen Non-Primer', 'Energi', 'Teknologi', 'Kesehatan', 'Properti & Real Estat',
  'Barang Baku', 'Transportasi & Logistik', 'Keuangan', 'Perindustrian', 'Infrastruktur']

// Emiten lolos syarat (`gagal(x)` kosong) per sektor, tanpa bank & asuransi, urut PE TTM terendah.
// Kunci SEMUA berisi gabungan seluruh sektor dengan urutan yang sama.
export function lolosPerSektor(rows, gagal) {
  const h = { [SEMUA]: [] }
  for (const x of rows) {
    const s = x.kelas?.sektor
    if (SEKTOR.includes(s) && !bankAsuransi(x) && !gagal(x).length) {
      (h[s] ||= []).push(x)
      h[SEMUA].push(x)
    }
  }
  for (const s in h) h[s].sort((a, b) => a.kuartal.pe - b.kuartal.pe)
  return h
}
