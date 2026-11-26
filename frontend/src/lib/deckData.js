// Mengumpulkan semua hasil analisa satu emiten untuk presentasi unduhan, memakai fungsi yang sama
// dengan halaman (Analisa, Teknikal, Spekulasi, Story/Pengendali, Injeksi). Data pelengkap yang gagal
// dimuat tidak membatalkan presentasi; slide terkait dilewati.
import { buildAnalysis } from './analysis.js'
import { analysisProsCons, deepView, cycleOf, mechOf, injSteps, simDefaults, simKjpp, peerMultiples, kjppStatus, MECH_LABEL, txValue } from './emitenExtra.js'
import { progressOf, posisiOf, dealOf, MILESTONES } from './domain.js'
import { indicators, taSignals, buildPlan, taVerdict } from './ta.js'
import { analyzePatterns, bestBullPattern, polaPlan, levels, structure } from './patterns.js'
import { sectorOf } from './deckThemes.js'
import { riCase, riCalc, riRange, riFunding } from './rightsIssue.js'
import { recommend } from './recommend.js'
import { laporanBaru } from './pembaruan.js'
import { newsTake } from './news.js'
import { newsConclusion } from './newsConclusion.js'

const safe = p => p.catch(() => null)

// ctx: { store, api, storyOf, getBenchmark, onStep(text) }
export async function collectDeck(t, { store, api, storyOf, getBenchmark, onStep = () => {} }) {
  const item = store.items.find(x => x.ticker === t) || null
  const verified = store.verified || {}
  const aset = store.aset?.[t] || null
  const profil = store.profil?.[t] || null

  onStep('Mengambil profil & laporan Stockbit')
  const profile = await api.get('/api/profile', { ticker: t })
  let reports = (store.updates || []).filter(u => u.ticker === t && /^sb-report-/.test(u.id))
  if (!reports.length) reports = await api.get('/api/reports', { ticker: t }).then(j => j.items || [], () => [])
  reports = [...reports].sort((a, b) => String(b.date).localeCompare(String(a.date)))

  onStep('Mengambil kepemilikan, harga, dan siklus')
  // Benchmark siklus: daftar "KODE:tanggal PTW" seluruh transaksi radar (format yang dibaca server).
  const deals = (store.items || []).filter(x => x.tender?.start).map(x => `${x.ticker}:${String(x.tender.start).slice(0, 10)}`).sort().join(',')
  const [benchmark, insider, quote, ohlc] = await Promise.all([
    item && deals ? safe(getBenchmark ? getBenchmark(deals) : api.get('/api/benchmark', { deals })) : null,
    safe(api.get('/api/insider', { ticker: t, days: 365 })),
    safe(api.get('/api/quote', { ticker: t })),
    safe(api.get('/api/ohlc', { ticker: t, tf: '1y' })),
  ])
  const A = buildAnalysis({ ticker: t, item, profile, reports, insider, quote, verified, pengendali: store.pengendali,
    pandangan: store.pandangan, analisa: store.analisa, benchmark })
  const extra = { profil, aset, hsc: store.hsc?.kode || [], bm: benchmark, verified }

  // Progres transaksi (hanya emiten radar).
  const ctx = { aset: store.aset || {}, verified }
  const prog = item ? progressOf(item, ctx) : null
  const story = item ? storyOf(t) : null

  // Teknikal & rencana transaksi dari candle harian 1 tahun.
  onStep('Menghitung teknikal & pola chart')
  const bars = (ohlc?.bars || []).filter(b => b.c > 0)
  let tech = null
  if (bars.length >= 35) {
    const ind = indicators(bars), sig = taSignals(bars, ind)
    const PA = analyzePatterns(bars, ind)
    const plan = buildPlan(bars, ind, sig), bp = bestBullPattern(PA)
    const lv = levels(bars, 120)
    tech = { bars, ind, sig, verdict: taVerdict(sig), PA, plan, bp, planPola: bp ? polaPlan(plan, bp) : null, lv, struct: structure(bars, PA, lv) }
  }

  // Simulasi nilai KJPP dengan kelipatan pembanding dari Stockbit.
  let sim = null, mech = null, steps = []
  if (aset || A.sv?.injectType) {
    mech = mechOf(aset, A.sv)
    steps = injSteps(mech, { sv: A.sv, ms: prog?.ms || {} })
    const peers = (aset?.pembanding || []).filter(x => /^[A-Z]{4}$/.test(x)).slice(0, 5)
    // Simulasi otomatis: kelipatan pembanding Stockbit (bila ada) + acuan cadangan tambang dari simDefaults.
    let m = { n: 0 }, peersOk = []
    if (peers.length) {
      onStep('Membandingkan dengan emiten sejenis')
      const ps = await Promise.all(peers.map(p => safe(api.get('/api/profile', { ticker: p }))))
      m = peerMultiples(ps)
      peersOk = peers.filter((_, i) => ps[i])
    }
    sim = { ...simKjpp({ ...simDefaults(aset, A.sv), per: m.per, ps: m.ps, pbv: m.pbv }), peers, peersOk, n: m.n }
  }

  const sector = sectorOf({ baru: story?.baru || verified[t]?.baru, aset: [aset?.aset?.sektor, aset?.aset?.nama].filter(Boolean).join(' '),
    sektor: profile?.sector, industri: profile?.industry, nama: item?.name || profile?.name })
  const out = {
    t, name: item?.name || profile?.name || A.p?.name || '', sector, date: new Date().toISOString().slice(0, 10),
    A, item, profile, reports, aset, profil, pv: store.pengendali?.[t] || null, pa: A.pa,
    pc: analysisProsCons(A, extra), deep: deepView(A, extra), cyc: cycleOf(A, extra),
    prog, pos: item && prog ? posisiOf(item, prog, { verified }) : null, deal: item && prog ? dealOf(item, prog, { verified }) : null,
    story, tech, sim, mech, mechLabel: mech ? MECH_LABEL[mech] : '', steps, kjpp: kjppStatus(aset?.kjpp), tx: txValue(aset, A.sv),
    milestones: MILESTONES,
  }
  // Rights issue (bila ada rencana penambahan modal) pada harga awal analisa, lalu rekomendasi tindakan.
  out.ri = riCase(A, { aset, sv: verified[t], item, pv: store.pengendali?.[t], doc: store.riDoc?.[t],
    reports: [...(A.reps || []), ...(store.updates || []).filter(u => u.ticker === t)] })
  if (out.ri) {
    out.riP = riRange(out.ri).start
    out.riR = riCalc(out.ri, out.riP, 0)
    out.riF = riFunding(out.ri, out.riR)
  }
  out.riDoc = store.riDoc?.[t] || null
  out.rec = recommend(out)
  out.riset = store.riset?.[t] || null   // riset aset lintas sumber (aset-riset.json) untuk infografis
  // Laporan material yang lebih baru dari analisa/riset kurasi (ditampilkan di slide ringkasan).
  out.lapBaru = laporanBaru(store.updates || [], t, { pandangan: store.pandangan || {}, riset: store.riset || {} })
  // Berita terkini (Stockbit Reports + media, diperbarui server tiap 2 jam) dan kesimpulannya.
  const news = (store.updates || []).filter(u => u.ticker === t && u.title)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  out.newsSum = newsConclusion(news, { ticker: t })
  out.newsRecent = news.filter(u => u.type && u.type !== 'lainnya' || /penjelasan|suspensi|gembok|hentikan/i.test(u.title)).slice(0, 5)
    .map(u => ({ u, take: newsTake(u, { items: store.items || [], pandangan: store.pandangan || {} }) }))
  return out
}
