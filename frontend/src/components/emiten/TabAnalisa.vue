<script setup>
import { computed, reactive, shallowRef, ref, watch } from 'vue'
import { api } from '../../api.js'
import { store, getBenchmark } from '../../store.js'
import { buildAnalysis, KURS, W } from '../../lib/analysis.js'
import { fmt, fmtDate, rp, big, x2, pctTxt, tglHargaAcuan } from '../../lib/domain.js'
import { riCase } from '../../lib/rightsIssue.js'
import RightsIssue from './RightsIssue.vue'
import RiDokumen from './RiDokumen.vue'
import { analysisProsCons, deepView, dilusi, radarGeom } from '../../lib/emitenExtra.js'
import SikapTag from '../SikapTag.vue'
import ProsCons from './ProsCons.vue'
import ProfilOrang from './ProfilOrang.vue'
import ControllerTrack from './ControllerTrack.vue'
import NetworkMap from '../NetworkMap.vue'
import { errText } from './ta/useOhlc.js'
import { dokumenBaru } from '../../lib/docWatch.js'

const props = defineProps({ ticker: String })
// Keterbukaan material yang terbit setelah analisa dokumen terakhir (otomatis dari sinkron Stockbit Reports).
const docNew = computed(() => dokumenBaru(props.ticker, store.updates, store.riDoc?.[props.ticker]))
const loading = ref(true), error = ref(''), A = shallowRef(null), bm = shallowRef(null), ctrl = shallowRef(null)
// Rincian hitung: klik skor = tabel bobot; klik dimensi = langkah nilai dimensi itu.
const showCalc = ref(false), openDim = ref('')
const total = computed(() => (A.value?.dims || []).reduce((s, d) => s + d.s * W[d.k], 0))
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), 1)
function pickDim(k) {
  openDim.value = openDim.value === k ? '' : k
  if (openDim.value) setTimeout(() => document.getElementById('dim-' + k.replace(/\W+/g, '-'))?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
}
const HI_SIGNAL = /(transaksi material|perubahan kegiatan usaha|inbreng|HMETD|penilai|akuisisi|pengambilalihan|tender|RUPS|private placement|penempatan terbatas)/i
const NOISE = /(volatilitas|permintaan penjelasan bursa)/i

// Isian kalkulator dilusi (Rp miliar / Rp / %), diisi ulang tiap analisa baru.
const kc = reactive({ V: 0, C: 0, P: 0, T: 0, H: 100 })

let seq = 0
async function load() {
  const t = props.ticker, my = ++seq
  loading.value = true; error.value = ''; A.value = null; bm.value = null
  try {
    const item = store.items.find(x => x.ticker === t)
    const profile = await api.get('/api/profile', { ticker: t })
    // Laporan: untuk emiten radar pakai data yang sudah tersinkron; selain itu ambil dari Stockbit Reports.
    let reports = store.updates.filter(u => u.ticker === t && /^sb-report-/.test(u.id))
    if (!reports.length) reports = await api.get('/api/reports', { ticker: t }).then(j => j.items || [], () => [])
    reports = [...reports].sort((a, b) => String(b.date).localeCompare(String(a.date)))
    // Data pelengkap: gagal tidak membatalkan analisa.
    const [benchmark, insider, quote] = await Promise.all([
      item ? getBenchmark().catch(() => null) : null,
      api.get('/api/insider', { ticker: t, days: 365 }).catch(() => null),
      api.get('/api/quote', { ticker: t }).catch(() => null),
    ])
    if (my !== seq) return
    const a = buildAnalysis({ ticker: t, item, profile, reports, insider, quote, verified: store.verified,
      pengendali: store.pengendali, pandangan: store.pandangan, analisa: store.analisa, benchmark })
    const k = a.pa?.kalkulator || {}
    Object.assign(kc, { V: Math.round((k.nilaiDibayarSaham ?? a.injRp ?? 0) / 1e8) / 10, C: Math.round((k.kasSegar || 0) / 1e8) / 10,
      P: k.hargaPelaksanaan || a.tender?.price || a.price, T: 0, H: 100 })
    bm.value = benchmark
    A.value = a
    // Rekam jejak harga pengendali: riwayat kepemilikan 5%+ atas nama pengendali (dimuat terpisah, tidak menahan analisa).
    ctrl.value = null
    const nm = String(a.ctrlName || '').replace(/\s*\(.*\)$/, '').split(/,\s*(?=[A-Z])/)[0].trim()
    if (nm) api.get('/api/controller', { ticker: t, name: nm }).then(c => { if (my === seq) ctrl.value = c }).catch(() => {})
  } catch (e) {
    if (my === seq) error.value = errText(e)
  } finally {
    if (my === seq) loading.value = false
  }
}
watch(() => [props.ticker, store.ready], load, { immediate: true })

const tone = s => s >= 6.5 ? 'good' : s >= 4.5 ? 'warn' : 'strong'
const STANCE = { good: 'good', warn: 'warn', bad: 'strong' }
const rr = v => v.toFixed(1).replace('.', ',')

// Tangga harga: semua level + harga kini di satu sumbu.
const ladder = computed(() => {
  const a = A.value
  if (!a?.price || !a.levels.length) return null
  const vals = [a.price, ...a.levels.map(l => l[2])], lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
  const x = v => 4 + (v - lo) / span * 92
  return { now: x(a.price), ticks: a.levels.map((l, i) => ({ k: l[0], v: l[2], x: x(l[2]), up: i % 2 === 1 })) }
})

const calcMode = computed(() => {
  const a = A.value
  if (!a?.shares || !a.price) return null
  const k = a.pa?.kalkulator || {}
  // Penerbitan sudah tereksekusi: jumlah saham sekarang sudah memuat saham baru.
  if (k.sudahTereksekusi || (!a.pa && a.sv?.executed)) return 'done'
  if (!(k.nilaiDibayarSaham ?? a.injRp ?? 0) && !k.kasSegar && !a.sv?.injectType) return null
  return 'on'
})
// Model sederhana: hak tebus proporsional, nilai per saham = (ekuitas + aset diakui + kas) ÷ total saham.
const calc = computed(() => dilusi({ S0: A.value.shares, E0: A.value.equity || 0, f: (A.value.flt ?? 0) / 100,
  V: (+kc.V || 0) * 1e9, C: (+kc.C || 0) * 1e9, P: +kc.P || 0, tk: (+kc.T || 0) / 100, h: (+kc.H || 0) / 100 }))
const KC = [
  ['V', 'Nilai dibayar dengan saham baru (Rp miliar)', 0.1, 'inbreng / konversi utang'],
  ['C', 'Kas segar masuk (Rp miliar)', 0.1, 'setoran tunai HMETD'],
  ['P', 'Harga pelaksanaan (Rp)', 1, 'harga saham baru'],
  ['T', 'Publik menebus (%)', 5, '0 = publik tidak ikut'],
  ['H', 'Nilai aset diakui (%)', 5, 'uji skeptis atas penilaian'],
]
// Analisa PMHMETD/PMTHMETD bila ada rencana penambahan modal.
const ri = computed(() => A.value ? riCase(A.value, { aset: store.aset[props.ticker], sv: store.verified[props.ticker],
  item: store.items.find(x => x.ticker === props.ticker), pv: store.pengendali[props.ticker], doc: store.riDoc?.[props.ticker],
  // Semua keterbukaan & berita emiten (bukan hanya 8 terakhir) untuk menilai tahap dan keterbukaan terakhir.
  reports: [...A.value.reps, ...store.updates.filter(u => u.ticker === props.ticker)] }) : null)
const holders = computed(() => (A.value?.holders || []).filter(h => Math.abs(h.change) >= 0.1 || A.value.isCtrlH(h)).slice(0, 8))
// Infografis: radar enam dimensi, kelebihan vs kekurangan, sudut pandang mendalam.
const extra = computed(() => ({ profil: store.profil[props.ticker], aset: store.aset[props.ticker], hsc: store.hsc?.kode || [],
  bm: bm.value, verified: store.verified }))
const pc = computed(() => A.value ? analysisProsCons(A.value, extra.value) : null)
const deep = computed(() => A.value ? deepView(A.value, extra.value) : [])
const radar = computed(() => A.value?.dims?.length ? radarGeom(A.value.dims) : null)
const radarLabel = computed(() => 'Radar skor enam dimensi, skala 0 sampai 10: ' + (A.value?.dims || []).map(d => `${d.k} ${fmt(d.s, 1)}`).join(', '))
const hiSig = r => HI_SIGNAL.test(r.title) && !NOISE.test(r.title)
</script>

<template>
  <p v-if="loading" class="load muted">Menganalisa {{ ticker }}: memuat profil, harga, dan keterbukaan informasi dari Stockbit…</p>
  <div v-else-if="error" class="err"><strong>Analisa {{ ticker }} gagal dimuat</strong><span>{{ error }}. Pastikan website dibuka lewat jalankan-radar.sh dan token Stockbit masih berlaku.</span></div>
  <div v-else-if="A" class="an">
    <aside v-if="docNew.length" class="docnew" role="status">
      <b>{{ docNew.length }} keterbukaan material belum masuk analisa dokumen</b>
      <span class="muted small">{{ store.riDoc?.[ticker]?.asOf ? 'terbit setelah analisa dokumen ' + fmtDate(store.riDoc[ticker].asOf) : 'emiten belum punya analisa dokumen (120 hari terakhir)' }}</span>
      <ul class="small"><li v-for="u in docNew.slice(0, 6)" :key="u.id">{{ fmtDate(String(u.date).slice(0, 10)) }} · <a v-if="u.url" :href="u.url" target="_blank" rel="noopener">{{ u.title }}</a><template v-else>{{ u.title }}</template></li></ul>
    </aside>
    <!-- Skor & sikap: satu baris tegas. -->
    <section class="verdict rule-top">
      <p class="vline">
        <button type="button" class="scorebtn" :aria-expanded="String(showCalc)" title="Klik untuk melihat perhitungan skor" @click="showCalc = !showCalc">
          <b class="cond score" :class="'c-' + STANCE[A.stance.id]">{{ A.score }}</b><span class="cond muted of">/100</span>
        </button>
        <strong :class="'c-' + STANCE[A.stance.id]">{{ A.stance.t }}</strong>
        <button type="button" class="linkbtn small" @click="showCalc = !showCalc">{{ showCalc ? 'Tutup perhitungan' : 'Lihat perhitungan skor' }}</button>
      </p>
      <div v-if="showCalc" class="calc">
        <table class="ledger">
          <thead><tr><th>Dimensi</th><th class="num">Nilai (0–10)</th><th class="num">Bobot</th><th class="num">Kontribusi</th></tr></thead>
          <tbody>
            <tr v-for="d in A.dims" :key="d.k" class="clk" @click="pickDim(d.k)">
              <td><button type="button" class="linkbtn">{{ d.k }}</button></td>
              <td class="num">{{ fmt(d.s, 1) }}</td><td class="num">× {{ Math.round(W[d.k] * 100) }}%</td><td class="num">= {{ fmt(d.s * W[d.k], 3) }}</td>
            </tr>
          </tbody>
          <tfoot><tr><th colspan="3">Jumlah × 10 (dibulatkan)</th><th class="num">{{ fmt(total, 3) }} × 10 = {{ A.score }}</th></tr></tfoot>
        </table>
        <p class="small muted">Kesimpulan: ≥ 65 asimetri positif · 45–64 netral · &lt; 45 spekulatif tinggi. Klik nama dimensi untuk melihat langkah hitungnya.</p>
      </div>
      <p class="small muted">
        <template v-if="A.p.sector || A.p.industry">{{ [A.p.sector, A.p.industry].filter(Boolean).join(' · ') }} · </template>
        Harga {{ rp(A.price) }}<template v-if="A.priceDate"> (penutupan {{ fmtDate(A.priceDate) }})</template>
        · kapitalisasi {{ big(A.mcap) }} · porsi publik {{ A.flt != null ? fmt(A.flt, 2) + '%' : 'belum ada' }}
        · pengendali {{ A.ctrlName || 'belum ada' }}<template v-if="A.ctrlPct != null"> ({{ fmt(A.ctrlPct, 2) }}%)</template>
      </p>
    </section>

    <!-- Pandangan analis. -->
    <section v-if="A.pa" class="pa rule-top">
      <h2>Pandangan analis</h2>
      <p class="pa-head"><SikapTag :sikap="A.pa.sikap" /> <b>{{ A.pa.ringkas }}</b></p>
      <p>{{ A.pa.tesis }}</p>
      <div class="grid">
        <div>
          <h3 class="lbl">Nilai wajar kasar</h3>
          <template v-if="A.pa.nilaiWajar && A.pa.nilaiWajar.bawah != null">
            <p class="big cond">{{ rp(A.pa.nilaiWajar.bawah) }} – {{ rp(A.pa.nilaiWajar.atas) }}</p>
            <p class="small muted">vs harga kini {{ rp(A.price) }}: {{ pctTxt(A.pa.nilaiWajar.bawah, A.price) }} s.d. {{ pctTxt(A.pa.nilaiWajar.atas, A.price) }}</p>
            <p class="small muted">{{ A.pa.nilaiWajar.metode || '' }}</p>
          </template>
          <p v-else class="small muted">Data belum cukup untuk nilai wajar yang jujur.</p>
        </div>
        <div>
          <h3 class="lbl">Hitungan dilusi</h3>
          <template v-if="A.pa.dilusi && A.pa.dilusi.berlaku">
            <table class="ledger"><tbody>
              <tr v-if="A.pa.dilusi.sahamSekarang"><td>Saham sekarang</td><td class="r num">{{ fmt(A.pa.dilusi.sahamSekarang / 1e6, 0) }} jt</td></tr>
              <tr v-if="A.pa.dilusi.sahamBaru"><td>Saham baru</td><td class="r num">+{{ fmt(A.pa.dilusi.sahamBaru / 1e6, 0) }} jt</td></tr>
              <tr v-if="A.pa.dilusi.porsiPublikSetelah != null"><td>Porsi publik (tidak menebus)</td><td class="r num">{{ fmt(A.pa.dilusi.porsiPublikSekarang ?? 0, 2) }}% → {{ fmt(A.pa.dilusi.porsiPublikSetelah, 2) }}%</td></tr>
              <tr v-if="A.pa.dilusi.nilaiPerSaham"><td>Nilai per saham pasca-transaksi</td><td class="r num">{{ rp(A.pa.dilusi.nilaiPerSaham) }} <span class="muted small">{{ pctTxt(A.pa.dilusi.nilaiPerSaham, A.price) }}</span></td></tr>
            </tbody></table>
            <p class="small muted">{{ A.pa.dilusi.asumsi || '' }} {{ A.pa.dilusi.catatan || '' }}</p>
          </template>
          <p v-else class="small muted">{{ A.pa.dilusi?.catatan || 'Tidak ada rencana penerbitan saham baru yang material.' }}</p>
        </div>
      </div>
      <div class="grid">
        <div><h3 class="lbl">Variabel kunci</h3>
          <ul v-if="(A.pa.variabelKunci || []).length"><li v-for="x in A.pa.variabelKunci" :key="x">{{ x }}</li></ul><p v-else class="small muted">belum ada</p></div>
        <div><h3 class="lbl">Tesis salah bila</h3>
          <ul v-if="(A.pa.tesisSalahBila || []).length"><li v-for="x in A.pa.tesisSalahBila" :key="x">{{ x }}</li></ul><p v-else class="small muted">belum ada</p></div>
      </div>
      <p v-if="A.pa.pengendaliBergerak" class="small"><b>Pergerakan pengendali:</b> {{ A.pa.pengendaliBergerak }}</p>
      <p v-if="A.pa.likuiditas" class="small"><b>Likuiditas:</b> {{ A.pa.likuiditas }}</p>
      <div v-if="(A.pa.pembaruan || []).length" class="small"><b>Pembaruan {{ fmtDate(A.pa.asOf || '') }}:</b>
        <ul><li v-for="x in A.pa.pembaruan" :key="x">{{ x }}</li></ul></div>
      <p class="small muted">Pandangan analis per {{ fmtDate(A.pa.asOf || '') }}<template v-if="A.pa.hargaAcuan"> · harga acuan {{ rp(A.pa.hargaAcuan) }}<template v-if="A.pa.hargaAsOf"> per {{ fmtDate(tglHargaAcuan(A.pa)) }}</template></template>. Kerangka berpikir, bukan rekomendasi beli/jual.</p>
    </section>

    <section class="rule-top">
      <h2>{{ A.pa ? 'Ringkasan otomatis' : 'Tesis' }}</h2>
      <p class="thesis">{{ A.thesis }}</p>
    </section>

    <!-- Peta skor (radar) dan kelebihan vs kekurangan. -->
    <section class="rule-top">
      <h2>Kelebihan vs kekurangan</h2>
      <div class="ig">
        <figure v-if="radar" class="radar">
          <svg viewBox="-56 -14 372 256" role="img" :aria-label="radarLabel">
            <polygon v-for="(ring, i) in radar.rings" :key="i" class="ring" :points="ring" />
            <line v-for="([x, y], i) in radar.axes" :key="'x' + i" class="ax" :x1="radar.cx" :y1="radar.cy" :x2="x" :y2="y" />
            <polygon class="area" :points="radar.area" />
            <g v-for="d in radar.dots" :key="d.k" class="clk" @click="pickDim(d.k)">
              <circle :class="'d-' + tone(d.s)" :cx="d.x" :cy="d.y" r="4.5" />
              <text class="rl" :x="d.lx" :y="d.ly" :text-anchor="d.anchor">{{ d.k.split(' ')[0] }} <tspan class="rv">{{ fmt(d.s, 1) }}</tspan></text>
            </g>
          </svg>
          <figcaption class="small muted">Peta skor enam dimensi, 0 di tengah sampai 10 di tepi. Klik nilai untuk melihat perhitungannya.</figcaption>
        </figure>
        <ProsCons v-if="pc" :pros="pc.pros" :cons="pc.cons" />
      </div>
    </section>

    <section v-if="deep.length" class="rule-top">
      <h2>Sudut pandang mendalam</h2>
      <ol class="deep">
        <li v-for="[h, t] in deep" :key="h"><b>{{ h }}</b><p>{{ t }}</p></li>
      </ol>
    </section>

    <!-- Enam dimensi pada satu skala 0–10. -->
    <section class="rule-top">
      <h2>Penilaian enam dimensi</h2>
      <div class="dims">
        <div class="axis" aria-hidden="true"><span></span><span class="sc"><i style="left:0">0</i><i style="left:50%">5</i><i style="left:100%">10</i></span><span></span></div>
        <div v-for="d in A.dims" :id="'dim-' + d.k.replace(/\W+/g, '-')" :key="d.k" class="dim">
          <span class="dk"><button type="button" class="dimbtn" :aria-expanded="String(openDim === d.k)" @click="pickDim(d.k)"><b>{{ d.k }}</b> <span class="muted small">bobot {{ Math.round(W[d.k] * 100) }}% · {{ openDim === d.k ? 'tutup' : 'lihat hitungan' }}</span></button></span>
          <span class="track" role="meter" :aria-label="d.k" aria-valuemin="0" aria-valuemax="10" :aria-valuenow="d.s"><i :class="'b-' + tone(d.s)" :style="{ width: d.s * 10 + '%' }"></i></span>
          <span class="ds cond">{{ fmt(d.s, 1) }}</span>
          <p v-if="d.why.length" class="why small muted">{{ d.why.join(' ') }}</p>
          <div v-if="openDim === d.k" class="steps small">
            <table>
              <tbody>
                <tr v-for="(st, i) in d.steps || []" :key="i">
                  <td>{{ st.t }}</td>
                  <td class="num"><b v-if="st.set != null">= {{ fmt(st.set, 1) }}</b><b v-else :class="st.v > 0 ? 'c-good' : 'c-strong'">{{ sgn(st.v) }}</b></td>
                </tr>
                <tr v-if="d.raw != null && d.raw !== d.s"><td>Dibatasi ke rentang 0–10 (hasil hitung {{ fmt(d.raw, 1) }})</td><td class="num"><b>= {{ fmt(d.s, 1) }}</b></td></tr>
                <tr class="tot"><td>Nilai {{ d.k }} × bobot {{ Math.round(W[d.k] * 100) }}%</td><td class="num"><b>{{ fmt(d.s, 1) }} × {{ fmt(W[d.k], 2) }} = {{ fmt(d.s * W[d.k], 3) }}</b></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- Skenario harga: tangga + tabel. -->
    <div class="grid">
      <section class="rule-top">
        <h2>Skenario harga</h2>
        <template v-if="A.levels.length">
          <div v-if="ladder" class="ladder" aria-hidden="true">
            <div class="rail"></div>
            <span v-for="t in ladder.ticks" :key="t.k" class="tk" :class="{ up: t.up }" :style="{ left: t.x + '%' }"><i></i><b class="cond">{{ rp(t.v) }}</b></span>
            <span class="nowm" :style="{ left: ladder.now + '%' }"><i></i><b class="cond">Harga kini {{ rp(A.price) }}</b></span>
          </div>
          <table class="ledger"><tbody>
            <tr v-for="l in A.levels" :key="l[0]"><td><b>{{ l[0] }}</b><div class="small muted">{{ l[1] }}</div></td><td class="r num">{{ rp(l[2]) }}</td><td class="r muted">{{ pctTxt(l[2], A.price) }}</td></tr>
          </tbody></table>
        </template>
        <p v-else class="small muted">Data harga belum cukup.</p>
        <p v-if="A.rr != null" class="small">Rasio risk/reward <b>{{ rr(A.rr) }} : 1</b>. Investor berpengalaman umumnya baru tertarik di atas 3 : 1 untuk saham berlikuiditas tipis.</p>
        <template v-if="A.sv?.injectType">
          <h3 class="lbl">Injeksi aset</h3>
          <p class="small"><b>{{ A.sv.injectType }}</b><template v-if="A.sv.injectTarget"> · {{ A.sv.injectTarget }}</template><template v-if="A.sv.nominal"> · {{ A.sv.nominal }}</template><template v-if="A.injRp && /USD|SGD/.test(A.sv.nominal)"> (≈{{ big(A.injRp) }}, kurs asumsi Rp{{ KURS.USD.toLocaleString('id-ID') }}/USD)</template></p>
        </template>
      </section>
      <section class="rule-top cases">
        <h2>Kasus naik</h2>
        <ul v-if="A.bull.length"><li v-for="x in A.bull" :key="x">{{ x }}</li></ul><p v-else class="small muted">Tidak ada yang menonjol.</p>
        <h2>Kasus turun & red flag</h2>
        <ul v-if="A.bear.length"><li v-for="x in A.bear" :key="x">{{ x }}</li></ul><p v-else class="small muted">Tidak ada yang menonjol.</p>
      </section>
    </div>

    <!-- Bila analisa rights issue memuat data pengendali dari dokumen, bagian ini tidak diulang. -->
    <section v-if="A.pv && !ri?.doc?.pengendali" class="rule-top">
      <h2>Pengendali & rencananya</h2>
      <p v-if="A.pv.bukanPengambilAlih" class="warn">Nama di kolom pengendali adalah pengendali lama/penjual atau bukan pengambil alih.</p>
      <p><b>Siapa:</b> {{ A.pv.siapa }}</p>
      <p><b>Grup:</b> {{ A.pv.grup }}</p>
      <p><b>Rencana:</b> {{ A.pv.rencana }}</p>
      <p class="warn"><b>Catatan investor:</b> {{ A.pv.catatan }}</p>
    </section>

    <ProfilOrang v-if="extra.profil" :profil="extra.profil" :sb="A.p" />
    <ControllerTrack v-if="ctrl" :c="ctrl" :self="ticker" :old-ctrl="!!store.pengendali[ticker]?.bukanPengambilAlih" />
    <NetworkMap v-if="extra.profil" :focus="ticker" />

    <RightsIssue v-if="ri" :c="ri" :ticker="ticker" :name="A.p?.name || store.items.find(x => x.ticker === ticker)?.name || ''" />
    <!-- Tanpa penambahan modal menurut dokumen, kewajaran transaksi aset tetap ditampilkan. -->
    <section v-else-if="store.riDoc?.[ticker]" class="rule-top">
      <h2>Transaksi aset menurut dokumen</h2>
      <p class="small muted">{{ store.riDoc[ticker].status || 'Belum ada rencana penambahan modal' }}; simulasi rights issue tidak ditampilkan.</p>
      <RiDokumen :doc="store.riDoc[ticker]" />
    </section>

    <!-- Kalkulator dilusi. -->
    <!-- Kalkulator dilusi hanya tampil bila tidak ada analisa rights issue (simulasinya sudah ada di sana). -->
    <section v-if="calcMode && !ri" class="rule-top">
      <h2>Kalkulator dilusi & nilai per saham</h2>
      <p v-if="calcMode === 'done'" class="small muted">Penerbitan saham baru sudah tereksekusi — jumlah saham dan porsi publik saat ini sudah mencerminkan dilusinya. Lihat <b>Hitungan dilusi</b> di pandangan analis untuk posisi sebelum dan sesudah.</p>
      <template v-else>
        <div class="inputs">
          <label v-for="[k, label, step, hint] in KC" :key="k" class="in">
            <span class="small">{{ label }}</span>
            <input v-model.number="kc[k]" class="field" type="number" :step="step" min="0">
            <em class="small muted">{{ hint }}</em>
          </label>
        </div>
        <p v-if="!calc" class="small muted">Isi harga pelaksanaan.</p>
        <dl v-else class="out">
          <div><dt>Saham baru</dt><dd><b>{{ fmt(calc.N / 1e6, 0) }} jt</b><span>{{ x2(calc.N / calc.S0) }} saham sekarang</span></dd></div>
          <div><dt>Total saham</dt><dd><b>{{ fmt(calc.S1 / 1e6, 0) }} jt</b></dd></div>
          <div><dt>Porsi publik</dt><dd><b>{{ fmt(calc.pubAfter * 100, 2) }}%</b><span>dari {{ fmt(calc.f * 100, 2) }}%</span></dd></div>
          <div><dt>Nilai buku / saham</dt><dd><b>{{ rp(calc.vps) }}</b><span>{{ pctTxt(calc.vps, A.price) }} vs harga {{ rp(A.price) }}</span></dd></div>
        </dl>
        <p class="small muted">{{ A.pa?.kalkulator?.dasar || 'Nilai awal dari data injeksi terverifikasi; harga pelaksanaan diasumsikan sama dengan harga PTW/harga kini.' }} Model sederhana: hak tebus proporsional, nilai per saham = (ekuitas + aset diakui + kas) ÷ total saham.</p>
      </template>
    </section>

    <!-- Pergerakan pemegang ≥5% dan likuiditas. -->
    <section v-if="holders.length || A.avgVal != null" class="rule-top">
      <h2>{{ holders.length ? 'Pergerakan pemegang saham ≥5% (365 hari)' : 'Likuiditas' }}</h2>
      <table v-if="holders.length" class="ledger">
        <thead><tr><th class="lbl">Pemegang</th><th class="lbl r">Porsi</th><th class="lbl r">Perubahan</th></tr></thead>
        <tbody>
          <tr v-for="h in holders" :key="h.name">
            <td><b>{{ h.name }}</b> <span v-if="A.isCtrlH(h)" class="tag t-calm">Pengendali</span>
              <span v-if="h.below5" class="tag t-warn" title="Tidak lagi tercantum di daftar pemegang ≥5% Stockbit; porsi di kolom adalah laporan ≥5% terakhir">kini {{ h.now != null ? fmt(h.now, 2) + '%' : '<5%' }}</span>
              <div class="small muted">{{ h.buys }}× beli · {{ h.sells }}× jual · {{ fmtDate(h.firstDate) }} – {{ fmtDate(h.lastDate) }}</div></td>
            <td class="r num">{{ fmt(h.from, 2) }}% → {{ fmt(h.to, 2) }}%</td>
            <td class="r num" :class="h.change >= 0 ? 'c-good' : 'c-strong'">{{ h.change >= 0 ? '+' : '' }}{{ fmt(h.change, 2) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="A.avgVal != null" class="small muted">Nilai transaksi harian rata-rata <b>{{ big(A.avgVal) }}</b> · keluar dari posisi Rp100 juta ±{{ A.exitDays < 1 ? '<1' : fmt(A.exitDays, 0) }} hari bila mengambil 20% volume harian.</p>
    </section>

    <section v-if="A.notes.length" class="rule-top">
      <h2>Catatan analis</h2>
      <ul><li v-for="x in A.notes" :key="x">{{ x }}</li></ul>
    </section>

    <div class="grid">
      <section class="rule-top">
        <h2>Yang harus terjadi agar tesis benar</h2>
        <ul v-if="A.checks.length"><li v-for="x in A.checks" :key="x">{{ x }}</li></ul><p v-else class="small muted">Tidak ada yang menonjol.</p>
      </section>
      <section class="rule-top">
        <h2>Sinyal untuk keluar</h2>
        <ul v-if="A.exits.length"><li v-for="x in A.exits" :key="x">{{ x }}</li></ul><p v-else class="small muted">Tidak ada yang menonjol.</p>
      </section>
    </div>

    <section class="rule-top">
      <h2>Keterbukaan informasi terbaru</h2>
      <ul v-if="A.reps.length" class="reps">
        <li v-for="r in A.reps" :key="(r.id || '') + r.date + r.title">
          <span class="cond d">{{ fmtDate(r.date) }}</span>
          <a v-if="r.url" :href="r.url" target="_blank" rel="noopener">{{ r.title }}</a><span v-else>{{ r.title }}</span>
          <span v-if="hiSig(r)" class="tag t-calm">sinyal tinggi</span>
        </li>
      </ul>
      <p v-else class="small muted">Belum ada laporan.</p>
    </section>

    <div class="foot">
      <a class="btn" :href="'https://stockbit.com/symbol/' + A.t" target="_blank" rel="noopener">Stockbit</a>
      <p class="small muted">Analisa otomatis berbasis aturan dari data Stockbit, data transaksi radar, riset pengendali, dan pola 32 transaksi backdoor. Kerangka berpikir, bukan rekomendasi beli/jual.</p>
    </div>
  </div>
</template>

<style scoped>
.docnew{border:1px solid var(--warn);border-left-width:4px;padding:8px 12px;margin:0 0 12px;display:flex;flex-direction:column;gap:2px}
.docnew ul{margin:4px 0 0;padding-left:18px}
.load{padding:18px 0}
.err{display:flex;flex-direction:column;gap:4px;padding:14px 0;border-top:2px solid var(--strong)}
.err strong{color:var(--strong)}
.an{display:flex;flex-direction:column;gap:22px}
section h2{margin-bottom:8px}
section p{margin:0 0 6px}
h3.lbl{margin:10px 0 6px;font-size:12.5px}
ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.r{text-align:right}
.num{font:700 16px var(--f-display);white-space:nowrap}
.ledger td.muted{white-space:nowrap}
.c-good{color:var(--good)} .c-warn{color:var(--warn)} .c-strong{color:var(--strong)}
.warn{padding:8px 12px;background:var(--warn-bg);color:var(--warn);border-left:3px solid var(--warn)}

.vline{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;margin:0 0 4px}
.score{font-size:48px;line-height:1;font-weight:700}
.of{font-size:20px}
.vline strong{font:700 24px var(--f-display);margin-left:10px}
.pa-head{display:flex;gap:10px;align-items:baseline}
.big{font-size:26px;font-weight:700;margin:0}
.thesis{max-width:80ch}

.dims{display:grid;grid-template-columns:minmax(150px,220px) 1fr 44px;column-gap:14px}
.axis,.dim{display:contents}
.axis .sc{position:relative;height:16px;font:600 11px var(--f-display);color:var(--ink-2)}
.axis i{position:absolute;font-style:normal;transform:translateX(-50%)}
.axis i:first-child{transform:none}
.axis i:last-child{transform:translateX(-100%)}
.dk,.track,.ds{padding-top:9px;border-top:1px solid var(--rule-2)}
.track{position:relative;align-self:stretch;background:linear-gradient(90deg,transparent calc(50% - .5px),var(--rule) calc(50% - .5px),var(--rule) calc(50% + .5px),transparent calc(50% + .5px))}
.track i{display:block;height:12px;margin-top:3px}
.b-good{background:var(--good)} .b-warn{background:var(--warn)} .b-strong{background:var(--strong)}
.ds{font-size:20px;font-weight:700;text-align:right;line-height:1.1}
.scorebtn,.dimbtn{border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer;text-align:left}
.scorebtn:hover .score,.dimbtn:hover b{text-decoration:underline;text-underline-offset:4px}
.clk{cursor:pointer}
.calc{margin:8px 0 4px;max-width:640px}
.calc .num,.steps .num{text-align:right;white-space:nowrap}
.calc tfoot th{text-align:left}
.steps{grid-column:1 / -1;margin:0 0 10px;padding:8px 12px;background:var(--sheet);border:1px solid var(--rule);max-width:720px}
.steps table{width:100%;border-collapse:collapse}
.steps td{padding:4px 0;border-bottom:1px solid var(--rule-2);vertical-align:top}
.steps td.num{padding-left:16px}
.steps tr.tot td{border-bottom:0;padding-top:6px}
.why{grid-column:1 / -1;margin:4px 0 8px}

.ladder{position:relative;height:78px;margin:6px 48px 10px}
.rail{position:absolute;left:0;right:0;top:46px;height:2px;background:var(--rule)}
.tk,.nowm{position:absolute;top:0;bottom:0;transform:translateX(-50%);display:flex;justify-content:center}
.tk i{position:absolute;top:40px;width:2px;height:14px;background:var(--ink-2)}
.tk b{position:absolute;top:58px;font-size:13px;white-space:nowrap;color:var(--ink-2)}
.tk.up b{top:20px}
.nowm i{position:absolute;top:30px;width:3px;height:32px;background:var(--ink)}
.nowm b{position:absolute;top:0;font-size:14px;white-space:nowrap;color:var(--ink)}
.cases h2+ul,.cases h2+p{margin-bottom:16px}

.inputs{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px 14px;margin-bottom:12px}
.in{display:flex;flex-direction:column;gap:3px}
.in input{width:100%;font:700 16px var(--f-display)}
.in em{font-style:normal}
.out{display:grid;grid-template-columns:repeat(2,1fr);margin:0 0 8px;border-top:1px solid var(--rule)}
.out div{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:7px 16px 7px 0;border-bottom:1px solid var(--rule-2)}
.out dt{color:var(--ink-2);font-size:13px}
.out dd{margin:0;text-align:right;display:flex;flex-direction:column}
.out dd b{font:700 17px var(--f-display);white-space:nowrap}
.out dd span{font-size:12px;color:var(--ink-2)}

.ig{display:grid;grid-template-columns:minmax(260px,340px) 1fr;gap:24px;align-items:start}
.radar{margin:0}
.radar svg{display:block;width:100%;height:auto}
.ring{fill:none;stroke:var(--rule-2);stroke-width:1}
.ax{stroke:var(--rule);stroke-width:1}
.area{fill:color-mix(in oklab,var(--accent) 18%,transparent);stroke:var(--accent);stroke-width:2;stroke-linejoin:round}
.radar circle{stroke:var(--sheet);stroke-width:2}
.d-good{fill:var(--good)} .d-warn{fill:var(--warn)} .d-strong{fill:var(--strong)}
.rl{font:600 12.5px var(--f-display);fill:var(--ink-2);letter-spacing:.02em}
.rv{font-weight:700;fill:var(--ink)}
.deep{list-style:none;counter-reset:dv;margin:0;padding:0;gap:0;max-width:96ch}
.deep li{counter-increment:dv;display:grid;grid-template-columns:28px 1fr;column-gap:8px;padding:8px 0;border-bottom:1px solid var(--rule-2)}
.deep li::before{content:counter(dv);grid-row:span 2;font:700 20px/1 var(--f-display);color:var(--ink-2)}
.deep p{margin:2px 0 0;font-size:13.5px}
.reps{list-style:none;padding:0;gap:0}
.reps li{display:flex;gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--rule-2)}
.reps .d{flex:none;width:92px;font-weight:600;color:var(--ink-2)}
.foot{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.foot p{margin:0;flex:1;min-width:240px}
@media (max-width:760px){
  .grid,.out,.ig{grid-template-columns:1fr}
  .radar{max-width:360px}
  .dims{grid-template-columns:1fr 40px}
  .axis{display:none}
  .dk{grid-column:1 / -1}
  .track{border-top:0;padding-top:4px}
  .ds{border-top:0;padding-top:0}
}
</style>
