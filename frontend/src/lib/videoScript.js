// Naskah video rangkuman analisis: adegan berurutan berisi teks narasi (gaya karya ilmiah, mudah dipahami)
// dan data visual untuk animasi di layar. Disusun otomatis dari hasil collectDeck(), sehingga isinya sama
// dengan tab Analisa dan presentasi unduhan. mode: 'ringkas' (±4 menit) atau 'lengkap' (±15–18 menit, setara presentasi). Urutan adegan
// mengikuti presentasi (ORDER): profil → pengendali → transformasi → berita → analisa → rights issue → teknikal → penutup.
import { fmtDate } from './domain.js'
import { phaseName } from './cycle.js'
import { riPriceNeeded, asetLaba, labaSebelumSesudah, riLayak, riScenarios, riTrading, riRating } from './rightsIssue.js'
import { valuasiSim, bandarView } from './valuasi.js'

const id = (v, d = 0) => v == null || isNaN(v) ? '–' : (+v).toLocaleString('id-ID', { maximumFractionDigits: d })
const rp = v => v == null || isNaN(v) ? '–' : 'Rp' + id(Math.round(v))
const big = v => v == null || isNaN(v) ? '–' : Math.abs(v) >= 1e12 ? `Rp${id(v / 1e12, 2)} T` : Math.abs(v) >= 1e9 ? `Rp${id(v / 1e9, 1)} M` : `Rp${id(v / 1e6, 0)} jt`
const pct = (v, d = 1) => v == null || isNaN(v) ? '–' : `${id(v, d)}%`
const ABBR = /\b(Pte|Ltd|Tbk|PT|Rp|No|dll|dsb|Inc|Co|Corp|Bhd|Sdn|Jl|Tn|Ny|Dr|Ir|St|maks|min|mis|sd|kl)\.$/i
export function sentences(s) {
  const parts = String(s || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
  const out = []
  for (const p of parts) if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += ' ' + p; else out.push(p)
  return out.filter(Boolean)
}
const first = (s, n = 1) => sentences(s).slice(0, n).join(' ')
// Judul huruf kapital semua (gaya keterbukaan BEI) dijadikan huruf kalimat agar wajar dibacakan.
const calmCase = t => { const x = String(t || ''); return x === x.toUpperCase() && /[A-Z]{4,}/.test(x) ? x.charAt(0) + x.slice(1).toLowerCase() : x }
const lower1 = s => { const t = String(s || ''); return t && !/^[A-Z]{2,}/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t }
const cap = s => { const t = String(s || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t }

// Teks yang dibacakan mesin suara: lihat lib/ucapan.js (angka → terbilang, singkatan dieja, satuan & istilah diucapkan wajar).
import { speakable } from './ucapan.js'
export { speakable }

// Urutan adegan mengikuti urutan slide presentasi (deck.js buildDeck).
const ORDER = ['buka', 'profilp', 'pengurus', 'pengendali', 'profil', 'transformasi', 'progres', 'berita', 'penjelasan-bursa', 'tesis', 'skor', 'kasus',
  'aset', 'rencana-korporasi', 'valuasi', 'ri', 'ri-kewajaran', 'ri-penilaian', 'ri-bisnis', 'ri-simulasi', 'ri-valuasi', 'ri-kelayakan',
  'teknikal', 'rencana', 'skenario', 'rekomendasi', 'tindakan', 'penutup']

// Satu adegan: { id, bab, judul, visual, lines: [teks] }. visual.type: title | kpis | bars | compare | ladder | list | rec.
export function buildVideo(d, mode = 'ringkas') {
  const A = d.A || {}, pa = d.pa || {}, full = mode === 'lengkap'
  const S = []
  const add = (id, bab, judul, visual, lines) => { const l = lines.filter(Boolean).map(cap); if (l.length) S.push({ id, bab, judul, visual, lines: l }) }

  // 1. Pembuka
  add('buka', 'Pembuka', `${d.t} · ${d.name || ''}`.trim(), { type: 'title', t: d.t, name: d.name, sikap: pa.sikap || A.stance?.t, score: A.score, sector: d.sector?.label }, [
    `Video ini merangkum hasil riset investasi atas ${d.name || d.t} dengan kode saham ${d.t}, sebuah emiten yang berada dalam radar backdoor listing.`,
    pa.sikap ? `Sikap analis terhadap saham ini adalah ${pa.sikap.toLowerCase()}, dengan skor analisis ${A.score ?? '–'} dari 100.` : `Skor analisis saham ini adalah ${A.score ?? '–'} dari 100.`,
    pa.ringkas ? first(pa.ringkas, 1) : null,
  ])

  // 2. Tesis (lengkap)
  if (full && pa.tesis) add('tesis', 'Tesis analis', 'Dasar penilaian analis', { type: 'list', items: sentences(pa.tesis).slice(0, 5) },
    sentences(pa.tesis).slice(0, 6))

  // 3. Pengendali
  const pv = d.pv || {}, o = d.profil?.pengendali?.[0]
  const docD = d.ri?.doc || d.riDoc || null, pgD = docD?.pengendali || null
  const hkD = (docD?.hukum?.daftar || []).filter(h => /berjalan|putusan|dugaan/i.test(h.status || ''))
  const rpD = v => Number.isInteger(+v) ? rp(v) : 'Rp' + id(v, 2)
  add('pengendali', 'Pengendali', 'Siapa pengendalinya', {
    type: 'kpis', items: [
      [pct(A.ctrlPct, 2), `Porsi ${A.ctrlName || 'pengendali'}`],
      A.tender?.price ? [rp(A.tender.price), 'Harga penawaran tender wajib (PTW)'] : null,
      A.flt != null ? [pct(A.flt, 1), 'Porsi publik'] : null,
    ].filter(Boolean),
  }, [
    pv.siapa ? first(pv.siapa, full ? 2 : 1) : `Pengendali saat ini adalah ${A.ctrlName || 'belum diketahui'} dengan porsi ${pct(A.ctrlPct, 2)}.`,
    A.tender?.price && A.price ? `Harga penawaran tender wajib tercatat ${rp(A.tender.price)}, sedangkan harga saat ini ${rp(A.price)}, atau ${A.price >= A.tender.price ? 'di atas' : 'di bawah'} harga tender sebesar ${id(Math.abs(A.price / A.tender.price - 1) * 100, 0)} persen.` : null,
    full && o ? `${o.nama} berperan sebagai ${String(o.peran || 'pengendali').toLowerCase()}. ${first(o.latar, 1)}` : null,
    // Dari dokumen: harga masuk, pemilik manfaat akhir, dan riwayat hukum.
    // Harga masuk tidak diulang bila kalimat pertama sudah menyebutnya.
    pgD?.hargaMasuk && A.price ? (String(pv.siapa || '').includes(rpD(pgD.hargaMasuk)) ? `Dengan harga saat ini, modal awal pengendali sudah berlipat ${id(A.price / pgD.hargaMasuk, 1)} kali.`
      : `Menurut dokumen, pengendali masuk pada harga ${rpD(pgD.hargaMasuk)} per saham${pgD.nilaiMasukRp ? ' dengan modal ' + big(pgD.nilaiMasukRp) : ''}, sehingga harga saat ini sudah ${id(A.price / pgD.hargaMasuk, 1)} kali harga masuknya.`) : null,
    full && (pgD?.ubo || []).length ? `Pemilik manfaat akhirnya adalah ${pgD.ubo.join(' dan ')}.` : null,
    hkD.length ? `Dokumen mencatat ${hkD.length} catatan hukum atau regulasi, antara lain ${lower1(hkD[0].isu).replace(/\.$/, '')}.` : docD?.hukum?.tidakDitemukan ? 'Tidak ditemukan riwayat masalah hukum di dokumen keterbukaan.' : null,
  ])

  // 3b. Profil pengendali (lengkap)
  if (full && o) {
    const rj = (o.rekamJejak || []).slice(0, 3)
    add('profil', 'Profil pengendali', o.nama, {
      type: 'list', items: [o.peran && `Peran: ${o.peran}`, o.entitas && `Melalui: ${o.entitas}`, ...rj.map(x => `${x.kode || x.entitas}: ${x.peran || ''}${x.periode ? ' (' + x.periode + ')' : ''}`)].filter(Boolean),
    }, [
      `${o.nama} merupakan ${lower1(o.peran || 'pengendali')}${o.entitas ? ' melalui ' + o.entitas : ''}.`,
      first(o.latar, 2),
      rj.length ? `Rekam jejaknya mencakup ${rj.map(x => x.entitas + (x.kode ? ` (${x.kode})` : '')).join(', ')}.` : null,
      rj[0]?.hasil ? first(rj[0].hasil, 1) : null,
      o.karakteristik ? first(o.karakteristik, 1) : o.risiko ? first(o.risiko, 1) : null,
    ])
  }

  // 2b. Profil perusahaan: angka kunci, pemegang saham utama, potensi target harga
  const m = A.p?.metrics || {}, stt = A.p?.stats || {}, prof = d.profile || A.p || {}
  const holders = (prof.shareholders || []).map(h => ({ ...h, pct: parseFloat(String(h.pct).replace(',', '.')) })).filter(h => h.pct > 0).slice(0, 3)
  const mcap = stt.marketCap || A.mcap
  add('profilp', 'Profil perusahaan', 'Profil perusahaan dan fundamental', {
    type: 'kpis', items: [mcap ? [big(mcap), 'Kapitalisasi pasar'] : null, m.pbv != null ? [`${id(m.pbv, 2)}×`, 'PBV'] : null,
      m.netMargin ? [String(m.netMargin).replace('.', ','), 'Margin laba bersih'] : null, m.ret1y ? [String(m.ret1y).replace('.', ','), 'Kinerja harga 1 tahun'] : null].filter(Boolean),
  }, [
    `${d.name || d.t} bergerak di sektor ${String(prof.sector || d.sector?.label || 'yang belum diketahui').toLowerCase()}${prof.industry ? ', industri ' + String(prof.industry).toLowerCase() : ''}, dengan kapitalisasi pasar sekitar ${big(mcap)}.`,
    m.pbv != null ? `Harga saham setara ${id(m.pbv, 2)} kali nilai bukunya${m.bvps != null ? ' yang sebesar ' + rp(m.bvps) + ' per saham' : ''}${m.netMargin ? ', dengan margin laba bersih ' + String(m.netMargin).replace('.', ',') : ''}.` : null,
    full && holders.length ? `Pemegang saham utamanya adalah ${holders.map(h => `${h.name} ${id(h.pct, 1)} persen`).join(', ')}.` : null,
    full && (prof.beneficiary || []).length ? `Pemilik manfaatnya tercatat ${prof.beneficiary.join(' dan ')}.` : null,
    full && m.low52 != null && m.high52 != null ? `Dalam 52 minggu terakhir harga bergerak antara ${rp(m.low52)} dan ${rp(m.high52)}.` : null,
  ])

  // 2c. Pengurus (lengkap)
  const board = [...(d.profil?.pengurus?.direksi || []), ...(d.profil?.pengurus?.komisaris || [])].filter(x => x && x.nama)
  if (full && board.length) {
    const nb = board.filter(x => x.orangPengendaliBaru)
    add('pengurus', 'Pengurus', 'Susunan direksi dan dewan komisaris', { type: 'list', items: board.slice(0, 6).map(x => `${x.nama}: ${x.jabatan || ''}`) }, [
      `Perseroan diurus oleh ${board.length} anggota direksi dan dewan komisaris.`,
      nb.length ? `Sebanyak ${nb.length} di antaranya berasal dari pihak pengendali baru, antara lain ${nb.slice(0, 2).map(x => x.nama).join(' dan ')}.` : 'Belum ada pengurus yang tercatat berasal dari pihak pengendali baru.',
    ])
  }

  // 3d. Transformasi bisnis: lama → pengendali baru → aset injeksi → bisnis baru
  const st = d.story || {}, sv = A.sv || {}
  const bLama = st.lama, bBaru = st.baru || sv.baru, bInj = [sv.injectType, sv.injectTarget].filter(Boolean).join(', ') || st.inject
  const bTarget = sv.target || st.target
  if (bLama || bBaru || bInj) add('transformasi', 'Transformasi bisnis', 'Dari bisnis lama ke bisnis baru', {
    type: 'list', items: [bLama && `Bisnis lama: ${bLama}`, bInj && `Aset injeksi: ${bInj}`, bBaru && `Bisnis baru: ${bBaru}`, bTarget && `Target: ${bTarget}`].filter(Boolean),
  }, [
    bLama ? `Sebelum pengambilalihan, perseroan bergerak di bidang ${lower1(bLama)}.` : null,
    bInj ? `Aset yang direncanakan masuk adalah ${lower1(bInj)}.` : null,
    bBaru ? `Arah bisnis barunya adalah ${lower1(bBaru)}.` : null,
    bTarget ? `Targetnya: ${lower1(first(bTarget, 1))}` : null,
    full && pv.rencana ? `Rencana pengendali: ${lower1(first(pv.rencana, 1))}` : null,
  ])

  // 5. Aset injeksi
  const det = d.ri?.detail, inj = d.ri?.inj || d.aset?.transaksi?.nilaiRp || null
  const asetNama = det?.nama || d.aset?.aset?.nama || A.sv?.injectTarget
  const kw = (d.ri?.doc || d.riDoc)?.kewajaran
  const lbA = asetLaba(d.ri?.doc || d.riDoc)
  if (asetNama || inj) add('aset', 'Aset injeksi', 'Aset yang akan diinjeksikan', {
    type: 'kpis', items: [
      det?.spread ? [`${big(det.lo)} – ${big(det.hi)}`, 'Nilai aset (indikatif, berbeda antarsumber)'] : inj ? [big(inj), 'Nilai transaksi aset'] : null,
      inj && A.mcap ? [`${id(inj / A.mcap, 1)}×`, 'Dibanding kapitalisasi pasar'] : null,
      [det?.kjpp?.status === 'terbit' ? 'Terbit' : det?.kjpp?.status === 'ditunjuk' ? 'Ditunjuk' : 'Belum ada', 'Penilaian KJPP'],
    ].filter(Boolean),
  }, [
    asetNama ? `Aset yang direncanakan masuk adalah ${asetNama}${det?.jenis ? ', berupa ' + det.jenis.toLowerCase() : ''}.` : null,
    !kw && det?.spread ? `Nilainya masih indikatif, berkisar ${big(det.lo)} hingga ${big(det.hi)} menurut sumber yang berbeda, dan perhitungan memakai ${big(inj)}.` : inj ? `Nilai transaksinya sekitar ${big(inj)}.` : null,
    inj && A.mcap ? `Nilai tersebut setara ${id(inj / A.mcap, 1)} kali kapitalisasi pasar ${d.t} saat ini.` : null,
    kw ? null : det?.kjpp?.status === 'terbit' ? `Penilai independen telah menerbitkan nilai${det.kjpp.nilai ? ' sebesar ' + big(det.kjpp.nilai) : ''}.` : 'Nilai aset tersebut belum diuji oleh penilai independen, sehingga masih berupa klaim.',
    full && det?.cara ? `Cara pembayarannya adalah ${det.cara.charAt(0).toLowerCase() + det.cara.slice(1)}.` : null,
    // Kewajaran nilai aset menurut dokumen asli (ri-dokumen.json).
    kw ? `Berdasarkan dokumen keterbukaan, nilai aset ini dinilai ${kw.putusan}. ${kw.ringkas || ''}` : null,
    ...(kw?.alasan || []).slice(0, full ? 3 : 1),
    lbA ? (lbA.rugi ? `Menurut laporan keuangannya, aset ini masih merugi ${big(-lbA.laba)}${lbA.periode ? ' pada periode ' + lbA.periode : ''}, sehingga harganya tidak ditopang laba.`
      : lbA.labaThn != null ? `Laba bersih aset setahun sekitar ${big(lbA.labaThn)}${lbA.per != null ? `, sehingga harga transaksi setara ${id(lbA.per, 1)} kali laba porsi yang diambil` : ''}.` : null)
      : (d.ri?.doc || d.riDoc) ? 'Laba aset belum diungkap dalam dokumen, sehingga nilai transaksi belum dapat diuji terhadap laba.' : null,
  ])

  // 5b. Struktur rencana korporasi (dari dokumen keterbukaan)
  const rkc = (d.ri?.doc || d.riDoc)?.rencanaKorporasi
  if (rkc && (rkc.langkah || []).length) {
    const st = rkc.langkah
    // Ringkas: langkah bernilai/berstatus berjalan atau rencana yang paling menentukan; Lengkap: seluruh langkah.
    const pick = full ? st : st.filter(x => /berjalan|rencana/.test(x.status || '') || /ambil alih|pengendali/i.test(x.judul)).slice(0, 4)
    const stTxt = x => x.status === 'selesai' ? 'sudah selesai' : x.status === 'berjalan' ? 'sedang berjalan' : 'masih rencana'
    add('rencana-korporasi', 'Rencana korporasi', 'Struktur rencana korporasi', {
      type: 'list', items: st.slice(0, full ? 9 : 6).map((x, i) => `${i + 1}. ${x.judul}${x.nilai && x.nilai !== '–' ? ' · ' + (String(x.nilai).length > 48 ? String(x.nilai).slice(0, 46) + '…' : x.nilai) : ''}`),
    }, [
      `Struktur rencana korporasinya terdiri atas ${st.length} langkah.`,
      first(rkc.ringkas, full ? 2 : 1),
      ...pick.map(x => `${x.judul}${x.waktu && x.waktu !== '–' ? ', ' + x.waktu : ''}, ${stTxt(x)}.${x.nilai && x.nilai !== '–' ? ' Nilainya ' + lower1(x.nilai).replace(/\.$/, '') + '.' : ''}${full && x.ket ? ' ' + first(x.ket, 1) : ''}`),
    ])
  }

  // 6. Penambahan modal (rights issue)
  if (d.ri && d.riR) {
    const c = d.ri, r = d.riR, f = d.riF, nd = riPriceNeeded(c, d.riP)
    const lbR = c.doc ? asetLaba(c.doc, { S1: r.S1, P: d.riP }) : null, ls = labaSebelumSesudah(c, r, lbR), ly = riLayak(c, r, lbR, ls), rt = riRating(ly, riTrading(c, r), c, r)
    const tgt = Math.max(0.1e12, Math.round(((r.total || 0) + (c.mcap || 0)) / 1e11) * 1e11)
    const vs = valuasiSim(c, r, { target: tgt }), bv = bandarView(c, r, d.riP, c.doc?.pengendali || {}, tgt)
    add('ri', 'Penambahan modal', c.label, {
      type: 'compare', from: { v: c.float || 0, l: 'Porsi publik sekarang' }, to: { v: r.pubAfter * 100, l: 'Bila publik tidak menebus' },
      extra: r.pubAfterInj != null ? { v: r.pubAfterInj * 100, l: 'Setelah injeksi tahap lanjutan' } : null,
      kpis: [[big(r.total), 'Nilai penerbitan'], [big(r.tunai), 'Dana tunai'], f ? [f.label, 'Pengumpulan dana'] : null].filter(Boolean),
    }, [
      `Perusahaan merencanakan ${c.label} dengan nilai penerbitan sekitar ${big(r.total)}, yaitu ${id(r.N / 1e9, 2)} miliar saham pada harga ${rp(d.riP)}.`,
      c.laterInj ? `Dana tahap pertama ini berupa uang tunai dan tidak digunakan untuk membeli aset; aset senilai ${big(c.laterInj)} akan dibayar dengan saham baru pada tahap berikutnya.` : null,
      `Bila pemegang saham publik tidak ikut menebus, porsi publik turun dari ${pct(c.float, 1)} menjadi ${pct(r.pubAfter * 100, 1)}${r.pubAfterInj != null ? `, dan dapat turun hingga ${pct(r.pubAfterInj * 100, 1)} setelah injeksi aset` : ''}.`,
      !full && vs ? `Bila perusahaan dihargai ${big(vs.target)} setelah rights issue, harga per saham sekitar ${rp(Math.round(vs.harga))}${vs.x ? `, atau ${id(vs.x, 2)} kali harga kini` : ''}${vs.pbvReal ? `, setara ${id(vs.pbvReal, 0)} kali nilai buku riil` : ''}.` : null,
      !full && bv ? `Dari sisi pengendali, harga impasnya sekitar ${rp(Math.round(bv.impas))}${bv.kelipatanAwal ? ` dan modal awalnya sudah berlipat ${id(bv.kelipatanAwal, 1)} kali` : ''}.` : null,
      !full && rt ? `Rekomendasinya ${rt.rating}. ${rt.sub} ${rt.partTxt}${ls ? (ls.akresi ? ' Laba per saham emiten naik setelah aset masuk.' : ' Laba per saham emiten justru turun setelah penerbitan.') : ''}` : null,
      !full && nd ? `Agar dana tunai ${big(nd.cash)} tercapai, harga saham sebaiknya berada di atas ${rp(Math.ceil(nd.ref))}, yaitu harga pelaksanaan ${rp(d.riP)} ditambah diskon dua puluh persen${nd.gap != null ? (nd.gap > 0 ? `; harga saat ini masih perlu naik ${id(nd.gap * 100, 0)} persen` : '; harga saat ini sudah memenuhi syarat tersebut') : ''}.` : null,
      f ? `Berdasarkan keterbukaan informasi terakhir${f.last ? ' pada ' + fmtDate(f.last.date) : ''}, peluang terkumpulnya dana dinilai ${f.label.toLowerCase()}.` : null,
      f ? first(f.reasons.filter(x => x.s < 0).map(x => x.t).join(' '), full ? 3 : 2) : null,
    ])
    if (full) {
      const doc = c.doc || {}, kwR = doc.kewajaran, pn = doc.aset?.penilaian, bs = doc.bisnis
      if (kwR) add('ri-kewajaran', 'Rights issue', 'Kewajaran nilai aset injeksi', { type: 'list', items: (kwR.alasan || []).slice(0, 4) }, [
        `Berdasarkan dokumen keterbukaan, nilai aset injeksi dinilai ${String(kwR.putusan || 'belum dapat dinilai').toLowerCase()}.`,
        kwR.ringkas ? first(kwR.ringkas, 1) : null, ...(kwR.alasan || []).slice(0, 3).map(x => first(x, 1)),
        kwR.syaratWajar ? `Nilai tersebut dapat dianggap wajar bila ${lower1(first(kwR.syaratWajar, 1))}` : null,
      ])
      if (pn) add('ri-penilaian', 'Rights issue', pn.judul || 'Penilaian aset injeksi', {
        type: 'kpis', items: (pn.simulasi || []).slice(0, 4).map(x => [`${/^Rp/.test(x.satuan || '') ? 'Rp' + id(x.nilai, x.nilai >= 100 ? 0 : 1) + (x.satuan || '').slice(2) : id(x.nilai, x.nilai >= 100 ? 0 : 1) + (x.satuan || '')}`, x.nama]),
      }, [pn.ringkas ? first(pn.ringkas, 2) : null, ...(pn.dicermati || []).slice(0, 2).map(x => `Yang harus diuji: ${lower1(x)}`), pn.kesimpulan ? first(pn.kesimpulan, 1) : null])
      if (bs?.model) add('ri-bisnis', 'Rights issue', 'Cara menghasilkan laba', { type: 'list', items: (bs.sumberPendapatan || []).slice(0, 4) }, [
        `Model bisnisnya: ${lower1(first(bs.model, 1))}`,
        (bs.sumberPendapatan || []).length ? `Sumber pendapatannya meliputi ${bs.sumberPendapatan.slice(0, 3).map(x => lower1(x)).join('; ')}.` : null,
        lbR?.labaThn != null ? `Laba aset setahun sekitar ${big(lbR.labaThn)}${lbR.per != null ? `, setara ${id(lbR.per, 1)} kali laba bila dibandingkan nilai transaksi` : ''}.` : 'Laba aset belum diungkap di dokumen.',
      ])
      const sc = riScenarios(c, d.riP)
      add('ri-simulasi', 'Rights issue', 'Simulasi harga rights issue dan kebutuhan dana', {
        type: 'kpis', items: [[rp(d.riP), 'Harga pelaksanaan simulasi'], nd ? [rp(Math.ceil(nd.ref)), 'Harga saham agar dana tercapai'] : null, [pct(r.dilusi * 100, 1), 'Dilusi bila tidak menebus'], r.terp != null ? [rp(r.terp), 'Harga teoretis setelah RI'] : null].filter(Boolean),
      }, [
        nd ? `Agar dana tunai ${big(nd.cash)} tercapai, harga saham sebaiknya berada di atas ${rp(Math.ceil(nd.ref))}, yaitu harga pelaksanaan ${rp(d.riP)} ditambah diskon dua puluh persen${nd.gap != null ? (nd.gap > 0 ? `; harga saat ini masih perlu naik ${id(nd.gap * 100, 0)} persen` : '; harga saat ini sudah memenuhi syarat tersebut') : ''}.` : null,
        r.terp != null ? `Setelah penerbitan, harga teoretis saham sekitar ${rp(r.terp)}, dan pemegang saham yang tidak menebus terdilusi ${pct(r.dilusi * 100, 1)}.` : null,
        sc?.rows?.length > 1 ? `Makin sedikit saham baru yang diterbitkan, makin tinggi harga rights issue dan harga saham yang dibutuhkan; pada rasio paling ketat harga yang dibutuhkan mencapai ${rp(Math.ceil(sc.rows[sc.rows.length - 1].need))}.` : null,
      ])
      if (vs || bv) add('ri-valuasi', 'Rights issue', 'Simulasi valuasi dan sudut pandang pengendali', {
        type: 'kpis', items: [vs ? [big(vs.target), 'Valuasi setelah RI'] : null, vs ? [rp(Math.round(vs.harga)), 'Harga per saham'] : null, bv ? [rp(Math.round(bv.impas)), 'Harga impas pengendali'] : null, bv?.kelipatanAwal ? [`${id(bv.kelipatanAwal, 1)}×`, 'Kelipatan modal awal'] : null].filter(Boolean),
      }, [
        vs ? `Bila perusahaan dihargai ${big(vs.target)} setelah rights issue, harga per saham sekitar ${rp(Math.round(vs.harga))}${vs.x ? `, atau ${id(vs.x, 2)} kali harga kini` : ''}${vs.pbvReal ? `, setara ${id(vs.pbvReal, 0)} kali nilai buku riil` : ''}.` : null,
        bv ? `Dari sisi pengendali, harga impasnya sekitar ${rp(Math.round(bv.impas))}${bv.kelipatanAwal ? ` dan modal awalnya sudah berlipat ${id(bv.kelipatanAwal, 1)} kali` : ''}.` : null,
        bv ? 'Makin besar saham yang didapat pengendali dari inbreng pada harga rendah, makin besar peluang distribusi setelah harga dinaikkan.' : null,
      ])
      if (ly) add('ri-kelayakan', 'Rights issue', 'Laba setelah aset masuk dan kelayakan investasi', { type: 'list', items: ly.reasons.slice(0, 5).map(x => (x.s > 0 ? '+ ' : x.s < 0 ? '− ' : '· ') + x.t) }, [
        ls ? `Laba bersih setahun berubah dari ${big(ls.before.laba)} menjadi ${big(ls.after.laba)}, dan laba per saham ${ls.akresi ? 'naik' : 'turun'} setelah penerbitan.` : 'Laba sebelum dan sesudah aset masuk belum dapat dihitung karena laba aset belum diungkap.',
        `Rekomendasinya ${rt.rating}. ${rt.sub} ${rt.partTxt}`,
        ...ly.reasons.filter(x => x.s < 0).slice(0, 2).map(x => first(x.t, 1)),
      ])
    }
  }

  // 6b. Progres & kronologi (lengkap)
  const KEY = /(transaksi material|kegiatan usaha|inbreng|HMETD|penilai|akuisisi|pengambilalihan|tender|RUPS|private placement|penambahan modal|hasil)/i
  const NOISE = /bukti iklan|panggilan RUPS|pemberitahuan RUPS|penggunaan dana hasil|public expose/i
  const evs = (d.reports || []).filter(r => r.date && KEY.test(r.title || '') && !NOISE.test(r.title || '')).slice(0, 4)
  if (full && (d.prog || evs.length)) add('progres', 'Kemajuan transaksi', 'Kemajuan transaksi dan kronologi', {
    type: 'list', items: evs.map(r => `${fmtDate(String(r.date).slice(0, 10))}: ${String(r.title).length > 90 ? String(r.title).slice(0, 88) + '…' : r.title}`),
  }, [
    d.prog ? `Kemajuan transaksi telah mencapai ${d.prog.pct} persen dari seluruh tahapan.` : null,
    d.pos?.now ? `Tahap yang sudah tercapai adalah ${lower1(d.pos.now)}.` : null,
    d.pos?.next ? `Tahap berikutnya adalah ${lower1(String(d.pos.next).split(' · ')[0])}.` : null,
    evs[0] ? `Keterbukaan informasi penting terakhir terbit pada ${fmtDate(String(evs[0].date).slice(0, 10))}.` : null,
  ])

  // 7. Skor enam dimensi (lengkap)
  if (full && (A.dims || []).length) {
    const sorted = [...A.dims].sort((a, b) => b.s - a.s)
    add('skor', 'Skor analisis', 'Penilaian enam dimensi', { type: 'bars', unit: '', max: 10, items: A.dims.map(x => ({ label: x.k, to: x.s })) }, [
      `Penilaian dilakukan pada enam dimensi dengan skala nol hingga sepuluh.`,
      `Dimensi terkuat adalah ${sorted[0].k} dengan skor ${id(sorted[0].s, 1)}, sedangkan yang terlemah adalah ${sorted[sorted.length - 1].k} dengan skor ${id(sorted[sorted.length - 1].s, 1)}.`,
      first((sorted[sorted.length - 1].why || []).join(' '), 1),
    ])
  }

  // 8. Valuasi
  const nw = pa.nilaiWajar, lv = (A.levels || []).filter(l => l[2] > 0)
  if (nw || lv.length) add('valuasi', 'Valuasi', 'Harga dibandingkan patokan nilai', {
    type: 'ladder', price: A.price, levels: [...lv.map(l => ({ v: l[2], l: l[0] })), ...(nw ? [{ v: nw.bawah, l: 'Nilai wajar bawah' }, { v: nw.atas, l: 'Nilai wajar atas' }] : [])],
  }, [
    nw && A.price ? `Nilai wajar kasar saham ini diperkirakan berada pada rentang ${rp(nw.bawah)} hingga ${rp(nw.atas)}, sementara harga saat ini ${rp(A.price)}.` : null,
    nw && A.price ? (A.price > nw.atas ? 'Dengan demikian, harga pasar sudah berada di atas batas atas nilai wajar.' : A.price < nw.bawah ? 'Dengan demikian, harga pasar berada di bawah batas bawah nilai wajar.' : 'Dengan demikian, harga pasar masih berada di dalam rentang nilai wajar.') : null,
    full && nw?.metode ? first(nw.metode, 1) : null,
    A.rr != null ? `Dari harga saat ini, rasio imbal hasil terhadap risiko tercatat ${id(A.rr, 1)} banding satu.` : null,
  ])

  // 8b. Skenario harga (lengkap)
  const sk = (A.levels || []).filter(l => l[2] > 0)
  if (full && sk.length && A.price) add('skenario', 'Skenario harga', 'Skenario harga ke depan', {
    type: 'bars', unit: '%', items: sk.map(l => ({ label: l[0], to: Math.abs(l[2] / A.price - 1) * 100 })), max: Math.max(...sk.map(l => Math.abs(l[2] / A.price - 1) * 100)),
  }, sk.slice(0, 4).map(l => `${l[0]} berada di ${rp(l[2])}, atau ${l[2] >= A.price ? 'naik' : 'turun'} ${id(Math.abs(l[2] / A.price - 1) * 100, 0)} persen dari harga saat ini, yaitu ${lower1(l[1])}.`))

  // 10. Harga & teknikal
  const tech = d.tech, cyc = d.cyc
  if (tech) add('teknikal', 'Harga & teknikal', 'Posisi harga dan sinyal teknikal', {
    type: 'kpis', items: [[rp(A.price), 'Harga terakhir'], tech.plan?.s?.sup ? [rp(tech.plan.s.sup), 'Support'] : null, tech.plan?.s?.res ? [rp(tech.plan.s.res), 'Resistance'] : null, tech.sig?.sig ? [tech.sig.sig[0], 'Sinyal teknikal'] : null].filter(Boolean),
  }, [
    cyc ? `Saham ini telah melewati ${cyc.day} hari sejak penawaran tender wajib dimulai, dan berada pada fase ${lower1(phaseName(cyc.ph) || 'yang belum terdefinisi')}.` : null,
    tech.sig?.sig ? `Secara teknikal, sinyal tergolong ${tech.sig.sig[0].toLowerCase()} dengan skor ${tech.sig.score > 0 ? 'plus ' : tech.sig.score < 0 ? 'minus ' : ''}${Math.abs(tech.sig.score)}.` : null,
    tech.plan?.s?.sup && tech.plan?.s?.res ? `Area support terdekat berada di sekitar ${rp(tech.plan.s.sup)}, sedangkan resistance di sekitar ${rp(tech.plan.s.res)}.` : null,
    full && tech.verdict ? cap(first(tech.verdict, 1)) : null,
  ])

  // 11. Kasus naik vs kasus turun (sama dengan tab Analisa dan presentasi)
  const bull = (A.bull || []).length ? A.bull : (d.pc?.pros || []).map(x => x.t), bear = (A.bear || []).length ? A.bear : (d.pc?.cons || []).map(x => x.t)
  if (bull.length || bear.length) add('kasus', 'Kasus naik dan turun', 'Pendorong kenaikan dan risiko penurunan', {
    type: 'list', items: [...bull.slice(0, 3).map(x => 'Naik: ' + x), ...bear.slice(0, 3).map(x => 'Turun: ' + x)],
  }, [
    `Analisis ini mencatat ${bull.length} pendorong kenaikan dan ${bear.length} risiko penurunan${bear.length > bull.length ? ', sehingga risiko lebih dominan' : ''}.`,
    bull[0] ? `Pendorong utamanya: ${lower1(first(bull[0], 1)).replace(/\.$/, '')}.` : null,
    bear[0] ? `Risiko utamanya: ${lower1(first(bear[0], 1)).replace(/\.$/, '')}.` : null,
    full && bear[1] ? `Selain itu, ${lower1(first(bear[1], 1)).replace(/\.$/, '')}.` : null,
    full && (A.notes || [])[0] ? `Catatan analis: ${lower1(first(A.notes[0], 1))}` : null,
  ])

  // 11d. Analisa penjelasan atas permintaan penjelasan bursa (terakhir)
  const pbx = (d.ri?.doc || d.riDoc)?.penjelasanBursa
  if (pbx && (pbx.poin || []).length) {
    // Memo riset: judul, poin utama, implikasi, dan butir yang belum dijawab lengkap (dapat dicek di dokumen).
    const mm = pbx.memo || {}
    const kurang = pbx.poin.filter(x => x.jawaban !== 'lengkap' && x.kurang), lengkap = pbx.poin.filter(x => x.jawaban === 'lengkap').length
    add('penjelasan-bursa', 'Penjelasan bursa', mm.judul || 'Tanggapan atas permintaan penjelasan bursa', {
      type: 'list', items: (mm.inti || pbx.poin.map(x => x.topik)).slice(0, 4),
    }, [
      `Tanggapan terakhir kepada bursa terbit pada ${fmtDate(pbx.tanggal)}; ${lengkap} dari ${pbx.poin.length} butir pertanyaan dijawab lengkap.`,
      mm.judul ? `${mm.judul}.` : first(pbx.ringkas, 1),
      (mm.implikasi || []).length ? `Implikasinya: ${mm.implikasi.slice(0, full ? 3 : 2).map(x => lower1(x).replace(/\.$/, '')).join('; ')}.` : null,
      kurang.length ? `Yang belum terjawab: ${kurang.slice(0, full ? 4 : 2).map(x => lower1(x.kurang).replace(/\.$/, '')).join('; ')}.` : null,
      pbx.kesimpulan,
    ])
  }

  // 11c. Perkembangan berita terkini
  const ns = d.newsSum, nr = d.newsRecent || []
  if (ns && nr.length) add('berita', 'Berita terkini', 'Perkembangan berita terkini', {
    type: 'list', items: nr.slice(0, full ? 4 : 3).map(({ u }) => `${fmtDate(String(u.date || '').slice(0, 10))}: ${String(u.title).length > 80 ? String(u.title).slice(0, 78) + '…' : u.title}`),
  }, [
    `Keterbukaan material terakhir terbit pada ${fmtDate(String(nr[0].u.date || '').slice(0, 10))}, berjudul ${calmCase(nr[0].u.title).replace(/\.$/, '')}.`,
    full && ns.paras[1] ? ns.paras[1] : null,
    ns.paras.find(p => /^Inti/.test(p)) || null,
    ns.verdict,
    ...(d.pa?.pembaruan || []).slice(0, full ? 2 : 1),
  ])

  // 10b. Rencana transaksi (lengkap)
  const pl = tech?.planPola || tech?.plan
  if (full && pl) add('rencana', 'Rencana transaksi', pl.type ? cap(String(pl.type).replace(/\s+—\s+/, ': ')) : 'Rencana transaksi', {
    type: 'kpis', items: pl.entry ? [[`${rp(pl.entryLo)}–${rp(pl.entryHi)}`, 'Zona entry'], [rp(pl.stop), 'Stop loss'], pl.tp1 ? [rp(pl.tp1), 'Target 1'] : null, pl.tp2 ? [rp(pl.tp2), 'Target 2'] : null].filter(Boolean)
      : [[rp(tech.sig?.res), 'Area kurangi saat rebound'], [rp(pl.stop), 'Keluar bila di bawah'], [rp(A.price), 'Harga kini']],
  }, pl.entry ? [
    `Rencana transaksinya: masuk di zona ${rp(pl.entryLo)} hingga ${rp(pl.entryHi)} dengan stop loss ${rp(pl.stop)}.`,
    pl.tp1 ? `Target pertama ${rp(pl.tp1)}${pl.tp2 ? ' dan target kedua ' + rp(pl.tp2) : ''}; di target pertama separuh posisi dijual dan stop dinaikkan ke titik impas.` : null,
  ] : [
    'Saat ini tidak ada setup beli.',
    `Bagi pemegang, rebound ke ${rp(tech.sig?.res)} dapat dimanfaatkan untuk mengurangi posisi, dan posisi dilepas penuh bila harga ditutup di bawah ${rp(pl.stop)}.`,
  ])

  // 12. Rekomendasi
  const rc = d.rec
  if (rc) add('rekomendasi', 'Rekomendasi', 'Rekomendasi', { type: 'rec', rec: rc }, [
    `Berdasarkan seluruh uraian tersebut, rekomendasi untuk saham ini adalah ${rc.label.toLowerCase()}.`,
    rc.entry ? (rc.entry[1] ? `Area pembelian berada pada ${rp(rc.entry[0])} hingga ${rp(rc.entry[1])}.` : `Pembelian baru layak dipertimbangkan apabila harga penutupan melampaui ${rp(rc.entry[0])} disertai kenaikan volume.`) : null,
    rc.stop ? `Batas risiko ditetapkan pada ${rp(rc.stop)}${rc.targets[0] ? `, dengan target pertama ${rp(rc.targets[0].p)}` : ''}.` : null,
    `Porsi yang disarankan adalah ${rc.porsi.charAt(0).toLowerCase() + rc.porsi.slice(1)}.`,
    rc.holder,
  ])

  // 12b. Rencana tindakan berdasarkan skenario (lengkap)
  if (full && rc) add('tindakan', 'Rencana tindakan', 'Rencana tindakan berdasarkan skenario', {
    type: 'list', items: [...(rc.triggers || []).slice(0, 2).map(x => 'Bila terkonfirmasi: ' + x), ...(rc.exits || []).slice(0, 2).map(x => 'Bila gagal: ' + x)],
  }, [
    (rc.triggers || [])[0] ? `Posisi dapat ditambah bertahap bila tesis terkonfirmasi; yang dipantau: ${lower1(first(rc.triggers[0], 1).replace(/^pantau\s+/i, '')).replace(/\.$/, '')}.` : null,
    `Kondisi sekarang: ${lower1(rc.label)}, dengan porsi ${lower1(rc.porsi)}.`,
    (rc.exits || [])[0] ? `Bila tesis gagal, misalnya ${lower1(first(rc.exits[0], 1)).replace(/\.$/, '')}, posisi dilepas dengan batas risiko ${rp(rc.stop)}.` : null,
    rc.catalyst ? `Katalis berikutnya adalah ${lower1(rc.catalyst)}.` : null,
  ])

  // 13. Penutup: yang perlu dipantau
  const watch = [...(rc?.triggers || A.checks || [])].slice(0, full ? 3 : 2).map(x => String(x).replace(/^pantau( apakah)?\s+/i, (m, a) => a ? 'apakah ' : '')), exits = (rc?.exits || A.exits || []).slice(0, full ? 2 : 1)
  add('penutup', 'Penutup', 'Hal yang perlu dipantau', { type: 'list', items: [...watch.map(x => 'Pantau: ' + x), ...exits.map(x => 'Sinyal keluar: ' + x)] }, [
    watch.length ? `Ke depan, hal yang perlu dipantau adalah ${watch.map(x => lower1(x).replace(/\.$/, '')).join('; ')}.` : null,
    exits.length ? `Posisi sebaiknya ditinjau ulang apabila ${lower1(exits[0]).replace(/\.$/, '').replace(/:\s*/, ', yang menandakan ')}.` : null,
    'Rangkuman ini disusun secara otomatis dari data publik dan bukan merupakan anjuran membeli atau menjual efek. Terima kasih.',
  ])
  return S.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
}

// Perkiraan durasi (detik) satu kalimat pada kecepatan baca normal (±2,4 kata per detik untuk suara Indonesia).
// Angka sudah dieja menjadi kata (kata pendek, diucapkan lebih cepat), jadi laju ±2,8 kata per detik.
export const lineSecs = (text, rate = 1) => Math.max(2.5, speakable(text).split(/\s+/).length / (2.8 * rate) + 0.4)

// Subtitle .srt dari perkiraan durasi.
export function toSrt(scenes, rate = 1) {
  const ts = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = (s % 60).toFixed(3).replace('.', ',').padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x}` }
  let t = 0, n = 0
  const out = []
  for (const sc of scenes) for (const l of sc.lines) { const d = lineSecs(l, rate); out.push(`${++n}\n${ts(t)} --> ${ts(t + d)}\n${l}\n`); t += d }
  return out.join('\n')
}
export const toScript = (scenes, d) => [`Naskah video rangkuman ${d.t}${d.name ? ' — ' + d.name : ''}`, '',
  ...scenes.flatMap((s, i) => [`${i + 1}. ${s.bab}: ${s.judul}`, ...s.lines, ''])].join('\n')
