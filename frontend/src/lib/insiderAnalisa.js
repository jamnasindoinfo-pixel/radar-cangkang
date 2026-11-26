// Analisa khusus insider satu emiten: pemegang baru >=5%, pergerakan per pihak, dan petunjuk yang perlu dicek
// (broker sama dengan pihak lain, jumlah lembar mirip perubahan pihak lain atau keterbukaan aksi korporasi).
// Masukan: baris /api/insider-rows (IDX & KSEI, sudah digabung server) dan, bila ada, hasil analisa mendalam
// (/api/pov-dalam) untuk aksi korporasi, kepemilikan, dan catatan broker. Fungsi murni; tidak mengarang data:
// setiap petunjuk menyebut angka dan tanggal sumbernya, dan tafsiran yang belum pasti ditulis sebagai kemungkinan.

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const tglPendek = d => { const [y, m, h] = String(d || '').slice(0, 10).split('-').map(Number); return y ? `${h} ${BLN[m - 1]} ${y}` : '-' }
const p2 = v => (+v || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%'
const jt = v => v == null ? '-' : (Math.abs(v) / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt lembar'
const rp = v => v == null ? '-' : v >= 1e9 ? 'Rp' + (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' miliar' : 'Rp' + Math.round(v / 1e6).toLocaleString('id-ID') + ' juta'
const hariAntara = (a, b) => Math.abs((new Date(a.slice(0, 10)) - new Date(b.slice(0, 10))) / 864e5)
// Nama pemegang tanpa bentuk badan usaha dan tanda baca, untuk mencocokkan IDX dan KSEI.
export const kunciNama = n => String(n || '').toUpperCase().replace(/\b(PT|TBK|LTD|PTE|LIMITED|INC|CO|CORP)\b\.?/g, '').replace(/[^A-Z0-9]/g, '')
export const MIRIP_TOL = 0.01       // jumlah lembar dianggap mirip bila selisih <= 1%
export const MIRIP_HARI = 30        // dan terjadi dalam 30 hari

// Pemegang baru >=5% dalam `hari` terakhir (porsi sebelumnya < 5%, tercatat sesudahnya >= 5%).
export function pemegangBaru(rows = [], { hari = 90, kini = new Date(), aksi = [] } = {}) {
  const batas = new Date(kini.getTime() - hari * 864e5).toISOString().slice(0, 10)
  const urut = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const calon = new Map()
  for (const r of urut) {
    if (r.date < batas || r.prevUnknown || (+r.prev || 0) >= 5 || (+r.cur || 0) < 5) continue
    calon.set(kunciNama(r.name), r)
  }
  return [...calon.values()].reverse().map(r => {
    const k = kunciNama(r.name)
    const sumber = String(r.source || '')
    const idx = sumber.includes('IDX') || rows.some(x => String(x.source || '').includes('IDX') && kunciNama(x.name) === k
      && (+x.cur || 0) > (+x.prev || 0) && hariAntara(x.date, r.date) <= 10)
    const lembar = r.curShares || r.chgShares || null
    // Perubahan pihak lain dengan jumlah lembar hampir sama (pengalihan blok, tender offer, nominee).
    const mirip = lembar ? rows.filter(x => kunciNama(x.name) !== k && hariAntara(x.date, r.date) <= MIRIP_HARI)
      .flatMap(x => [['porsi', x.curShares], ['perubahan', x.chgShares]].filter(([, v]) => v && Math.abs(Math.abs(v) - lembar) / lembar <= MIRIP_TOL)
        .map(([jenis, v]) => ({ nama: x.name, date: x.date, lembar: Math.abs(v), jenis, pct: x.cur })))
      .filter((m, j, a) => a.findIndex(y => kunciNama(y.nama) === kunciNama(m.nama) && y.date === m.date) === j) : []
    // Keterbukaan aksi korporasi yang menyebut jumlah lembar mirip (misalnya hasil tender offer).
    const aksiMirip = lembar ? aksi.filter(a => a.date && hariAntara(a.date, r.date) <= MIRIP_HARI).filter(a => {
      const teks = `${a.judul || ''} ${a.inti || ''}`
      return [...teks.matchAll(/(\d{1,3}(?:[.,]\d{1,3})?)\s*juta\s*(?:lembar\s*)?(?:saham|lembar)/gi)]
        .some(m => Math.abs(parseFloat(m[1].replace(',', '.')) * 1e6 - lembar) / lembar <= MIRIP_TOL)
    }).map(a => ({ date: a.date, judul: a.judul, inti: a.inti })) : []
    // Pihak lain yang memakai broker yang sama (180 hari).
    const brokerSama = r.broker ? [...new Set(rows.filter(x => kunciNama(x.name) !== k && String(x.broker || '').split(/,\s*/).includes(r.broker)
      && hariAntara(x.date, r.date) <= 180).map(x => x.name))] : []
    const tafsir = idx
      ? 'Masuk baru dengan keterbukaan IDX: pembelian atau pengalihan yang dilaporkan pihak itu sendiri.'
      : 'Hanya tercatat di KSEI tanpa keterbukaan IDX. Dua kemungkinan: pembeli baru (lewat pasar atau negosiasi) yang belum melapor, '
        + 'atau pemegang lama yang mengonversi saham warkat ke scripless sehingga baru tercatat. Belum bisa dipastikan dari data ini.'
    return { nama: r.name, date: r.date, prev: +r.prev || 0, cur: +r.cur || 0, lembar, harga: r.price || null, hargaPerkiraan: !!r.estPrice,
      nilai: r.value || null, broker: r.broker || '', asing: !!r.foreign, sumber, terverifikasi: idx, tafsir, mirip, aksiMirip, brokerSama }
  })
}

// Pergerakan bersih per pihak dalam beberapa rentang hari: porsi terakhir dikurangi porsi sebelum baris pertama di
// rentang itu. Tidak menjumlahkan tiap baris, karena KSEI mencatat per rekening (satu pihak bisa beberapa baris
// berantai di tanggal yang sama). Baris rekap tanpa porsi awal (prevUnknown) tidak dipakai sebagai titik awal.
export function gerakPihak(rows = [], { kini = new Date(), rentang = [30, 90, 180] } = {}) {
  const maks = Math.max(...rentang)
  const batas = h => new Date(kini.getTime() - h * 864e5).toISOString().slice(0, 10)
  const per = new Map()
  for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    if (r.date < batas(maks)) continue
    const k = kunciNama(r.name)
    per.set(k, [...(per.get(k) || []), r])
  }
  // Satu tanggal bisa berisi rantai (IDX bertahap 57,1→42,39→27,69 dan KSEI 57,1→27,69): ujung awal = porsi
  // sebelum yang tidak menjadi porsi sesudah baris lain, ujung akhir sebaliknya; bila ragu, baris dengan perubahan
  // terbesar (biasanya ringkasan KSEI).
  const tanggal = xs => [...new Set(xs.map(r => r.date))]
  const ujung = (xs, sisi) => {
    const pv = new Set(xs.map(r => r.prev)), cr = new Set(xs.map(r => r.cur))
    const kandidat = xs.filter(r => sisi === 'awal' ? !r.prevUnknown && !cr.has(r.prev) : !pv.has(r.cur))
    const pilih = (kandidat.length ? kandidat : xs).slice().sort((a, b) => Math.abs(b.cur - b.prev) - Math.abs(a.cur - a.prev))[0]
    return sisi === 'awal' ? (pilih.prevUnknown ? null : +pilih.prev || 0) : +pilih.cur || 0
  }
  return [...per.values()].map(xs => {
    const tg = tanggal(xs), akhirTgl = tg.at(-1), kini = ujung(xs.filter(r => r.date === akhirTgl), 'akhir'), ubah = {}
    for (const h of rentang) {
      const awalTgl = tg.find(d => d >= batas(h))
      const awal = awalTgl ? ujung(xs.filter(r => r.date === awalTgl), 'awal') : null
      ubah[h] = awal == null ? 0 : Math.round((kini - awal) * 100) / 100
    }
    return { nama: xs.at(-1).name, kini, n: xs.length, akhir: akhirTgl, ubah }
  }).sort((a, b) => Math.abs(b.ubah[maks]) - Math.abs(a.ubah[maks]))
}

// Analisa insider lengkap untuk tampilan dan PDF. hasil = analisa mendalam (boleh null).
export function analisaInsider(rows = [], hasil = null, { kini = new Date(), hari = 90 } = {}) {
  const aksi = hasil?.aksi || []
  const baru = pemegangBaru(rows, { hari, kini, aksi })
  const pihak = gerakPihak(rows, { kini })
  const terbaru = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  const akhirData = terbaru[0]?.date || ''
  const dibuat = String(hasil?.dibuat || '').slice(0, 10)
  const kalimat = [], cek = []
  for (const b of baru) {
    kalimat.push(`${b.nama}${b.asing ? ' (asing)' : ''} tercatat ${p2(b.prev)} → ${p2(b.cur)} pada ${tglPendek(b.date)}`
      + (b.lembar ? `, ${jt(b.lembar)}` : '') + (b.harga ? `, harga ${b.hargaPerkiraan ? 'perkiraan ' : ''}Rp${b.harga.toLocaleString('id-ID')}` : '')
      + (b.nilai ? ` (±${rp(b.nilai)})` : '') + ` lewat ${b.sumber}${b.broker ? ', broker ' + b.broker : ''}.`)
    cek.push(`Siapa ${b.nama} dan siapa pemilik manfaat akhirnya? ${b.terverifikasi ? 'Cek isi keterbukaan IDX-nya.' : 'Belum ada keterbukaan IDX; pantau laporan kepemilikan berikutnya.'}`)
    if (b.brokerSama.length) cek.push(`Broker ${b.broker} juga dipakai ${b.brokerSama.slice(0, 3).join(', ')}: cek apakah ${b.nama} terafiliasi dengan pihak itu.`)
    for (const m of b.mirip.slice(0, 2))
      cek.push(`Jumlah lembar ${b.nama} (${jt(b.lembar)}) hampir sama dengan ${m.jenis} ${m.nama} (${jt(m.lembar)}, ${tglPendek(m.date)}): cek kemungkinan pengalihan antarpihak.`)
    for (const a of b.aksiMirip.slice(0, 2))
      cek.push(`Jumlah lembar ${b.nama} (${jt(b.lembar)}) hampir sama dengan angka di keterbukaan ${tglPendek(a.date)} "${String(a.judul).slice(0, 90)}": cek apakah saham itu yang berpindah.`)
  }
  return {
    baru, pihak, terbaru, akhirData, kalimat, cek,
    analisa: hasil ? {
      dibuat, lama: !!(dibuat && akhirData && akhirData > dibuat),
      pemegang: (hasil.kepemilikan?.pemegang || []).slice(0, 8),
      insider: hasil.insider || [], riwayat: (hasil.riwayat || []).slice(-10).reverse(),
      marketMaker: hasil.marketMaker || [], harga: hasil.galian?.harga?.catatan || [],
    } : null,
  }
}
