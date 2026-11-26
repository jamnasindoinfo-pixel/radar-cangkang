// Simulasi valuasi target dan sudut pandang pengendali (bandar) atas penambahan modal.
// c = riCase(...), r = riCalc(c, P, u), P = harga pelaksanaan simulasi.

// Valuasi target (kapitalisasi setelah RI): harga per saham, kelipatan dari harga kini, PBV/PER tersirat,
// dan dua cara pengendali "mengambil" dana senilai `ambil` pada valuasi itu.
export function valuasiSim(c, r, { target, ambil = 0, labaSetahun = null } = {}) {
  if (!c || !r || !(target > 0) || !(r.S1 > 0)) return null
  const S0 = c.S0, S1 = r.S1, price = c.price || null
  const eqPre = c.equity ?? null
  // Ekuitas setelah transaksi: ekuitas awal + nilai penerbitan (aset dicatat pada nilai transaksi).
  const eqPost = eqPre != null ? eqPre + r.total : null
  const harga = target / S1
  const ctrlShares = c.ctrlPct != null ? (c.ctrlPct / 100) * S0 : null
  // Nilai buku riil: aset dicatat pada nilai buku dokumen (ekuitas aset × porsi yang diambil), bukan nilai transaksi;
  // dana tunai yang dipakai membeli aset tidak menambah ekuitas.
  const a = c.doc?.aset || {}, ke = a.keuangan || {}
  const asetBook = ke.ekuitasRp != null && a.porsiPersen ? ke.ekuitasRp * a.porsiPersen / 100 : null
  const tunaiAset = (a.caraBayar || []).filter(x => /tunai/i.test(x.cara || '')).reduce((t, x) => t + (x.nilaiRp || 0), 0)
  const eqReal = eqPre != null && asetBook != null ? eqPre + asetBook + Math.max(0, (r.tunai || 0) - tunaiAset) : null
  const out = {
    target, S1, harga, x: price ? harga / price : null, upside: price ? harga / price - 1 : null,
    eqPost, pbv: eqPost > 0 ? target / eqPost : null, bvps: eqPost != null ? eqPost / S1 : null,
    eqReal, pbvReal: eqReal > 0 ? target / eqReal : null, asetBook,
    per: labaSetahun > 0 ? target / labaSetahun : null, labaSetahun,
    vsTerp: r.terp ? harga / r.terp : null,
  }
  if (ambil > 0) {
    // (a) Pengendali menjual saham di pasar pada harga target (distribusi).
    const jualSaham = ambil / harga
    out.jual = { saham: jualSaham, pctPerusahaan: jualSaham / S1 }
    // (b) Pengendali menghimpun dana lewat RI baru pada valuasi target sebelum dana masuk (pre-money).
    const pRi = target / S1
    const nBaru = ambil / pRi
    out.ri = { harga: pRi, saham: nBaru, dilusi: nBaru / (S1 + nBaru), postMoney: target + ambil }
    out.ambil = ambil
    out.ctrlShares = ctrlShares
  }
  return out
}

// Sudut pandang pengendali: modal masuk, saham yang didapat dari inbreng & porsi HMETD, harga impas,
// dan laba kertas pada harga kini, harga teoretis, dan harga target.
// peng = ri-dokumen .pengendali ({ saham, porsiPersen, hargaMasuk, nilaiMasukRp }).
export function bandarView(c, r, P, peng = {}, target = null) {
  if (!c || !r || !(P > 0)) return null
  const S0 = c.S0
  const porsi = peng?.porsiPersen ?? c.ctrlPct
  const sahamAwal = peng?.saham || (porsi != null ? porsi / 100 * S0 : null)
  if (!(sahamAwal > 0)) return null
  const hargaMasuk = peng?.hargaMasuk || (peng?.nilaiMasukRp && sahamAwal ? peng.nilaiMasukRp / sahamAwal : null)
  const modalAwal = peng?.nilaiMasukRp || (hargaMasuk ? sahamAwal * hargaMasuk : null)
  // Bila transaksi sudah tereksekusi, atau pengendali masuk lewat inbreng/konversi/merger, porsi di dokumen sudah
  // porsi SETELAH penerbitan: saham inbreng dan tebusan tidak ditambahkan lagi.
  const sudah = c.status === 'tereksekusi' || /inbreng|konversi|merger/i.test(peng?.cara || '')
  // Saham untuk aset yang diinbreng diterima pemilik aset (diasumsikan pengendali/afiliasinya).
  const sahamInbreng = sudah ? 0 : (r.aset || 0) / P
  // Pengendali menebus porsinya atas bagian tunai.
  const tunaiPorsi = sudah ? 0 : (porsi || 0) / 100 * (r.tunai || 0)
  const sahamTebus = tunaiPorsi / P
  const totalSaham = sahamAwal + sahamInbreng + sahamTebus
  const totalModal = (modalAwal || 0) + tunaiPorsi + (sudah ? 0 : r.aset || 0)
  const nilaiPada = h => h ? totalSaham * h : null
  const hT = target && r.S1 ? target / r.S1 : null
  return {
    porsi, sahamAwal, hargaMasuk, modalAwal, sahamInbreng, sahamTebus, tunaiPorsi, asetDisetor: sudah ? 0 : r.aset || 0, sudah,
    totalSaham, totalModal, porsiSetelah: sudah ? (porsi || 0) / 100 : totalSaham / r.S1,
    impas: totalModal / totalSaham,
    kelipatanAwal: hargaMasuk && c.price ? c.price / hargaMasuk : null,
    nilaiKini: nilaiPada(c.price), nilaiTerp: nilaiPada(r.terp), nilaiTarget: nilaiPada(hT), hargaTarget: hT,
    labaKini: c.price ? nilaiPada(c.price) - totalModal : null,
    labaTerp: r.terp ? nilaiPada(r.terp) - totalModal : null,
    labaTarget: hT ? nilaiPada(hT) - totalModal : null,
    // Harga yang dibutuhkan agar modal awal pengendali berlipat 2× dan 5× (tanpa aset).
    harga2x: hargaMasuk ? hargaMasuk * 2 : null, harga5x: hargaMasuk ? hargaMasuk * 5 : null,
  }
}
