// Rekomendasi tindakan untuk presentasi analisa: menggabungkan sikap analis, skor enam dimensi, sinyal teknikal,
// rencana transaksi, nilai wajar, dan (bila ada) penilaian pengumpulan dana rights issue. Berbasis aturan,
// kerangka keputusan, bukan saran investasi personal.

const rp = v => v == null || isNaN(v) ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const pct = (a, b) => a && b ? `${a >= b ? '+' : ''}${Math.round((a / b - 1) * 100)}%` : ''

export const TIERS = {
  hindari: { label: 'Hindari atau kurangi posisi', tone: 'bad', porsi: '0%; pemegang saham disarankan mengurangi posisi saat harga memantul' },
  tunggu: { label: 'Menunggu konfirmasi, belum membeli', tone: 'warn', porsi: '0% pada saat ini; paling banyak 1–2% portofolio setelah syarat terpenuhi' },
  spekulatif: { label: 'Pembelian spekulatif terbatas', tone: 'warn', porsi: 'Paling banyak 1–2% portofolio, dibeli secara bertahap' },
  akumulasi: { label: 'Akumulasi secara bertahap', tone: 'good', porsi: 'Paling banyak 3–5% portofolio dalam 2–3 tahap pembelian' },
}

// d: hasil collectDeck (A, pa, tech, pos, ri, riF, aset, item).
export function recommend(d) {
  const A = d.A || {}, pa = d.pa || {}, tech = d.tech, pl = tech?.plan || null
  const sikap = String(pa.sikap || A.stance?.t || '')
  const techScore = tech?.sig?.score ?? 0
  const setup = !!pl?.entry
  const price = A.price
  let tier
  if (/hindari/i.test(sikap) || (A.score ?? 50) < 35) tier = 'hindari'
  else if (techScore <= -3 && !setup) tier = 'tunggu'
  else if (setup && (A.score ?? 0) >= 55 && techScore >= 1 && !/spekulatif tinggi/i.test(sikap)) tier = 'akumulasi'
  else if (setup && (A.score ?? 0) >= 45) tier = 'spekulatif'
  else tier = 'tunggu'
  // Pengumpulan dana rights issue yang diragukan menahan rekomendasi beli.
  if (d.riF?.key === 'doubt' && (tier === 'akumulasi' || tier === 'spekulatif')) tier = tier === 'akumulasi' ? 'spekulatif' : 'tunggu'
  const T = TIERS[tier]

  // Level harga: area beli, stop, target.
  const lv = Object.fromEntries((A.levels || []).map(l => [l[0], l[2]]))
  const nw = pa.nilaiWajar || null
  const res = tech?.plan?.s?.res, sup = tech?.plan?.s?.sup, sar = pl?.sar
  let entry = null, entryNote = ''
  if (setup) { entry = [pl.entryLo, pl.entryHi]; entryNote = 'zona pembelian berdasarkan rencana transaksi teknikal' }
  else if (tier !== 'hindari') {
    const trig = Math.max(...[sar, res].filter(v => v > 0 && v > (price || 0)))
    if (isFinite(trig)) { entry = [Math.round(trig), null]; entryNote = `pembelian dilakukan apabila harga penutupan melampaui ${rp(trig)} disertai kenaikan volume sebagai tanda pembalikan tren` }
  }
  const stop = pl?.stop || lv['Skenario turun'] || (sup ? Math.round(sup * 0.95) : null)
  const targets = [
    pl?.tp1 && { p: pl.tp1, l: 'target teknikal 1' }, pl?.tp2 && { p: pl.tp2, l: 'target teknikal 2' },
    lv['Harga PTW'] > (price || 0) && { p: lv['Harga PTW'], l: 'harga PTW' },
    lv['Skenario naik'] > (price || 0) && { p: lv['Skenario naik'], l: 'puncak siklus' },
  ].filter(Boolean).sort((a, b) => a.p - b.p).slice(0, 3)

  // Alasan utama: positif terkuat, negatif terkuat, posisi harga vs nilai wajar, teknikal, dana rights issue.
  const why = []
  if ((A.bull || [])[0]) why.push({ s: 1, t: A.bull[0] })
  if ((A.bear || [])[0]) why.push({ s: -1, t: A.bear[0] })
  if (nw && price) {
    if (price > nw.atas) why.push({ s: -1, t: `Harga saat ini (${rp(price)}) berada di atas nilai wajar kasar ${rp(nw.bawah)}–${rp(nw.atas)}, atau ${pct(price, nw.atas)} dari batas atasnya.` })
    else if (price < nw.bawah) why.push({ s: 1, t: `Harga saat ini (${rp(price)}) berada di bawah nilai wajar kasar ${rp(nw.bawah)}–${rp(nw.atas)}.` })
    else why.push({ s: 0, t: `Harga saat ini (${rp(price)}) berada dalam rentang nilai wajar kasar ${rp(nw.bawah)}–${rp(nw.atas)}.` })
  }
  if (tech?.sig?.sig) why.push({ s: techScore > 0 ? 1 : techScore < 0 ? -1 : 0, t: `Sinyal teknikal tergolong ${tech.sig.sig[0].toLowerCase()} dengan skor ${techScore > 0 ? '+' : ''}${techScore}.` })
  if (d.riF) why.push({ s: d.riF.key === 'done' || d.riF.key === 'likely' ? 1 : d.riF.key === 'doubt' ? -1 : 0, t: `Peluang terkumpulnya dana rights issue dinilai ${d.riF.label.toLowerCase()}.` })

  // Syarat masuk: bukti fundamental + konfirmasi teknikal bila tren turun.
  const triggers = [...(A.checks || [])]
  if (techScore < 0) triggers.push(sar && price && sar > price ? `Parabolic SAR berbalik ke bawah harga (saat ini ${rp(sar)})` : 'Indikator tren berbalik naik, ditandai MACD memotong garis sinyal dari bawah')
  if (d.riF && d.riF.key !== 'done') triggers.push('Pembeli siaga atau penyerap dana rights issue diumumkan secara resmi')

  const holder = tier === 'hindari' || techScore <= -3
    ? `Bagi pemegang saham, posisi sebaiknya dikurangi ketika harga memantul${res ? ' ke ' + rp(res) : ''} dan dilepas seluruhnya apabila harga penutupan turun di bawah ${rp(stop)}.`
    : `Bagi pemegang saham, posisi dapat dipertahankan selama harga bertahan di atas ${rp(stop)}, dengan merealisasikan sebagian keuntungan pada target pertama.`

  return {
    tier, ...T, sikap, score: A.score ?? null, techScore,
    profil: /spekulatif tinggi|hindari/i.test(sikap) ? 'Sangat tinggi' : 'Tinggi',
    // Horizon: tanggal katalis (target story/rights issue) bila ada; selain itu tahap berikutnya.
    horizon: (A.sv?.target || d.ri?.jadwal) ? `Sampai ${String(A.sv?.target || d.ri.jadwal).split(/[;(]/)[0].trim()}`
      : d.pos?.next ? `Sampai tahap berikutnya: ${d.pos.next}` : 'Jangka pendek hingga menengah; ditinjau ulang setiap terdapat keterbukaan informasi baru',
    entry, entryNote, stop, targets, why: why.slice(0, 5), triggers: triggers.slice(0, 4), exits: (A.exits || []).slice(0, 3), holder,
    catalyst: d.pos?.next || '', price,
  }
}
