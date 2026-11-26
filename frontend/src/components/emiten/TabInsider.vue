<script setup>
// Insider Activity: keterbukaan pemegang saham (IDX & KSEI, feed InsiderNews Stockbit) dengan label jenis
// perpindahan (crossing, repo, pengalihan, pergantian pengendali, dll.). Dua mode: emiten ini, atau semua
// emiten backdoor/potensi backdoor (radar, kandidat, dan perpindahan besar di emiten lain).
import { computed, ref, watch } from 'vue'
import { store, loadKandidat } from '../../store.js'
import { api } from '../../api.js'
import { fmtDate } from '../../lib/domain.js'
import { LABELS, REL_TEXT, prepare, byTicker } from '../../lib/insiderFlow.js'
import { analisaInsider } from '../../lib/insiderAnalisa.js'

const props = defineProps({ ticker: { type: String, required: true } })
const mode = ref('emiten')           // 'emiten' | 'semua'
const days = ref(30)                 // rentang hari (0 = semua data emiten)
const only = ref('')                 // filter satu label
const loading = ref(false), error = ref('')
const raw = ref([])

const ctx = computed(() => ({
  radar: new Set(store.items.map(x => x.ticker)),
  kandidat: new Set((store.kandidat.items || []).map(x => x.ticker)),
}))
const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)

async function load() {
  loading.value = true; error.value = ''
  try {
    if (mode.value === 'emiten') raw.value = (await api.get('/api/insider-rows', { ticker: props.ticker })).rows || []
    else {
      loadKandidat()
      raw.value = (await api.get('/api/insider-feed', { days: days.value || 30 })).rows || []
    }
  } catch (e) {
    error.value = e.status === 401 ? 'Token Stockbit ditolak.' : (e.message || 'Gagal memuat data insider.')
    raw.value = []
  } finally { loading.value = false }
}
watch([() => props.ticker, mode], () => { only.value = ''; if (mode.value === 'semua' && !days.value) days.value = 14; load() }, { immediate: true })
watch(days, () => { if (mode.value === 'semua') load() })

const rows = computed(() => {
  let r = prepare(raw.value, ctx.value)
  if (days.value) r = r.filter(x => x.date >= day(days.value))
  if (mode.value === 'semua') r = r.filter(x => x.rel)
  return r
})
const counts = computed(() => {
  const c = {}
  for (const r of rows.value) for (const l of r.labels) c[l] = (c[l] || 0) + 1
  return Object.keys(LABELS).filter(k => c[k]).map(k => ({ id: k, n: c[k] }))
})
const shown = computed(() => only.value ? rows.value.filter(r => r.labels.includes(only.value)) : rows.value)
const groups = computed(() => mode.value === 'semua' ? byTicker(shown.value).slice(0, 12) : [])
// Ringkasan emiten ini: pemegang dengan perubahan bersih terbesar dalam rentang.
const movers = computed(() => {
  if (mode.value !== 'emiten') return []
  const m = new Map()
  for (const r of [...shown.value].reverse()) {
    const g = m.get(r.name) || { name: r.name, from: r.prevUnknown ? r.cur : r.prev, to: r.cur, labels: new Set() }
    g.to = r.cur; r.labels.forEach(l => g.labels.add(l)); m.set(r.name, g)
  }
  return [...m.values()].map(g => ({ ...g, chg: g.to - g.from, labels: [...g.labels] }))
    .filter(g => Math.abs(g.chg) >= 0.5).sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 6)
})

const pct = v => (+v || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 }) + '%'
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(+v || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })
const lembar = v => v == null ? '' : Math.abs(v) >= 1e9 ? (Math.abs(v) / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' M'
  : Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt' : Math.abs(v).toLocaleString('id-ID')
// Unduh analisa khusus insider emiten ini (PDF): semua baris keterbukaan (bukan hanya rentang yang dipilih) ditambah
// catatan analisa mendalam bila sudah tersimpan.
const busyPdf = ref(false), busyGab = ref(false)
const baruN = computed(() => mode.value === 'emiten' ? analisaInsider(raw.value).baru.length : 0)
async function unduhInsider() {
  busyPdf.value = true; error.value = ''
  try {
    const pd = await api.get('/api/pov-dalam', { ticker: props.ticker }).catch(() => null)
    const hasil = pd?.status === 'selesai' ? pd.hasil : null
    const a = analisaInsider(raw.value, hasil)
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../../lib/insiderPdf.js')])
    ;(await P.insiderPdf({ t: props.ticker, nama: hasil?.nama || store.items.find(x => x.ticker === props.ticker)?.name || '', a }, jsPDF)).save(P.insiderPdfName(props.ticker, a))
  } catch (e) { error.value = 'PDF gagal: ' + (e.message || e) } finally { busyPdf.value = false }
}
// Analisa gabungan: analisa mendalam tersimpan (menu POV) ditambah bagian pemegang baru >=5% dari data terbaru.
async function unduhGabungan() {
  busyGab.value = true; error.value = ''
  try {
    const pd = await api.get('/api/pov-dalam', { ticker: props.ticker })
    if (pd?.status !== 'selesai') { error.value = `Analisa mendalam ${props.ticker} belum tersimpan. Buka menu POV, pilih ${props.ticker}, lalu tunggu analisanya selesai.`; return }
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../../lib/povDalamPdf.js')])
    ;(await P.povDalamPdf(pd.hasil, jsPDF, analisaInsider(raw.value, pd.hasil))).save(P.povDalamPdfName(pd.hasil))
  } catch (e) { error.value = 'PDF gagal: ' + (e.message || e) } finally { busyGab.value = false }
}
const ACT = { BUY: 'Beli', SELL: 'Jual', CROSS: 'Crossing', TRANSFER: 'Pengalihan', PRIVATE_PLACEMENT: 'Private placement', RIGHT_ISSUE: 'Rights issue', TENDER_OFFER: 'Tender offer' }
const actOf = a => ACT[a] || (a ? a.charAt(0) + a.slice(1).toLowerCase().replace(/_/g, ' ') : 'belum ada')
</script>

<template>
  <section class="rule-top">
    <div class="bar">
      <h2 class="lbl">Insider Activity</h2>
      <div class="ctl">
        <div role="group" aria-label="Cakupan" class="grp">
          <button type="button" class="pill" :aria-pressed="String(mode === 'emiten')" @click="mode = 'emiten'">{{ ticker }}</button>
          <button type="button" class="pill" :aria-pressed="String(mode === 'semua')" @click="mode = 'semua'">Semua backdoor &amp; potensi</button>
        </div>
        <div role="group" aria-label="Rentang" class="grp">
          <button v-for="[d, l] in (mode === 'emiten' ? [[30, '30 hari'], [90, '90 hari'], [365, '1 tahun'], [0, 'Semua']] : [[7, '7 hari'], [14, '14 hari'], [30, '30 hari']])"
            :key="d" type="button" class="pill sm" :aria-pressed="String(days === d)" @click="days = d">{{ l }}</button>
        </div>
      </div>
    </div>
    <div v-if="mode === 'emiten' && raw.length" class="unduh">
      <button type="button" class="pill" :disabled="busyPdf" @click="unduhInsider">{{ busyPdf ? 'Menyiapkan PDF…' : '⬇ Analisa insider (PDF)' }}</button>
      <button type="button" class="pill" :disabled="busyGab" @click="unduhGabungan">{{ busyGab ? 'Menyiapkan PDF…' : '⬇ Analisa gabungan (PDF)' }}</button>
      <span v-if="baruN" class="small tag t-good">{{ baruN }} pemegang baru ≥5% dalam 90 hari</span>
    </div>
    <p class="muted small sub">Keterbukaan pemegang saham dari IDX &amp; KSEI (Stockbit InsiderNews).
      <template v-if="mode === 'semua'">Hanya emiten radar, kandidat, dan emiten lain dengan perpindahan besar atau indikasi ganti pengendali.</template></p>

    <div v-if="counts.length" class="chips" role="group" aria-label="Saring keterangan">
      <button type="button" class="pill sm" :aria-pressed="String(!only)" @click="only = ''">Semua <b>{{ rows.length }}</b></button>
      <button v-for="c in counts" :key="c.id" type="button" class="pill sm" :aria-pressed="String(only === c.id)" :title="LABELS[c.id].why" @click="only = only === c.id ? '' : c.id">
        {{ LABELS[c.id].text }} <b>{{ c.n }}</b>
      </button>
    </div>

    <p v-if="loading" class="muted">Memuat data insider…</p>
    <p v-else-if="error" class="muted">Data insider belum bisa dimuat: {{ error }}</p>
    <p v-else-if="!shown.length" class="muted">{{ mode === 'emiten' ? `Tidak ada keterbukaan pemegang saham ${ticker} dalam rentang ini.` : 'Tidak ada aktivitas backdoor atau potensi backdoor dalam rentang ini.' }}</p>
    <template v-else>
      <!-- Ringkasan visual: per emiten (mode semua) atau per pemegang (mode emiten). -->
      <div v-if="groups.length" class="cards">
        <RouterLink v-for="g in groups" :key="g.ticker" class="card" :to="{ path: '/emiten/' + g.ticker, query: { tab: 'insider' } }">
          <div class="ch"><b>{{ g.ticker }}</b><span class="tag" :class="g.rel === 'potensi' ? 't-warn' : 't-calm'">{{ REL_TEXT[g.rel] }}</span></div>
          <div class="cn">{{ g.top.name }}</div>
          <div class="cm"><span :class="g.top.chg >= 0 ? 'c-good' : 'c-strong'">{{ sgn(g.top.chg) }} poin</span> · {{ pct(g.top.prev) }} → {{ pct(g.top.cur) }}</div>
          <div class="tags"><span v-for="l in g.labels.slice(0, 3)" :key="l" class="tag" :class="LABELS[l].tone">{{ LABELS[l].text }}</span></div>
        </RouterLink>
      </div>
      <div v-if="movers.length" class="movers">
        <div v-for="g in movers" :key="g.name" class="mv">
          <div class="mn" :title="g.name">{{ g.name }}</div>
          <div class="track" :aria-label="`${pct(g.from)} ke ${pct(g.to)}`">
            <i class="from" :style="{ width: Math.min(100, g.from) + '%' }" /><i class="to" :class="g.chg >= 0 ? 'up' : 'dn'" :style="{ width: Math.min(100, g.to) + '%' }" />
          </div>
          <div class="mp"><span :class="g.chg >= 0 ? 'c-good' : 'c-strong'">{{ sgn(g.chg) }}</span> {{ pct(g.from) }} → {{ pct(g.to) }}</div>
        </div>
      </div>

      <div class="scroll">
        <table class="ledger">
          <thead><tr>
            <th class="lbl">Tanggal</th><th v-if="mode === 'semua'" class="lbl">Kode</th><th class="lbl">Nama</th>
            <th class="lbl r">Perubahan</th><th class="lbl r">Sebelum → Sesudah</th><th class="lbl r">Harga</th>
            <th class="lbl">Aksi</th><th class="lbl">Sumber</th><th class="lbl">Keterangan</th>
          </tr></thead>
          <tbody>
            <tr v-for="(r, i) in shown.slice(0, 300)" :key="i">
              <td class="nw">{{ fmtDate(r.date) }}</td>
              <td v-if="mode === 'semua'"><RouterLink class="tk" :to="{ path: '/emiten/' + r.ticker, query: { tab: 'insider' } }">{{ r.ticker }}</RouterLink>
                <div v-if="r.rel" class="small muted">{{ REL_TEXT[r.rel] }}</div></td>
              <td><b>{{ r.name }}</b> <span v-if="r.role" class="tag t-calm">{{ r.role === 'direksi' ? 'D' : 'K' }}</span>
                <span v-if="r.foreign" class="small muted"> asing</span></td>
              <td v-if="r.prevUnknown" class="r num muted" title="Rekap KSEI beberapa rekening; porsi sebelumnya tidak ada di data">–</td>
              <td v-else class="r num"><span :class="r.chg >= 0 ? 'c-good' : 'c-strong'">{{ sgn(r.chg) }}%</span><div class="small muted">{{ lembar(r.chgShares) }}</div></td>
              <td class="r num nw">{{ r.prevUnknown ? '?' : pct(r.prev) }} → <b>{{ pct(r.cur) }}</b><div class="small muted">{{ lembar(r.curShares) }} lembar</div></td>
              <td class="r num">{{ r.price ? r.price.toLocaleString('id-ID') : '–' }}<div v-if="r.price && r.estPrice" class="small muted">perkiraan</div></td>
              <td>{{ actOf(r.action) }}<div v-if="r.purpose" class="small muted">{{ r.purpose }}</div></td>
              <td class="small">{{ r.source }}<template v-if="r.broker"> · {{ r.broker }}</template><div v-if="r.accounts > 1" class="muted">{{ r.accounts }} rekening</div></td>
              <td><span v-for="l in r.labels" :key="l" class="tag" :class="LABELS[l].tone" :title="LABELS[l].why">{{ LABELS[l].text }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="shown.length > 300" class="small muted">Menampilkan 300 dari {{ shown.length }} baris; persempit rentang atau saring keterangan.</p>
      <details class="legend small">
        <summary>Arti keterangan</summary>
        <dl><template v-for="(v, k) in LABELS" :key="k"><dt><span class="tag" :class="v.tone">{{ v.text }}</span></dt><dd>{{ v.why }}</dd></template></dl>
      </details>
    </template>
  </section>
</template>

<style scoped>
.unduh{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.lbl{margin:0}
.ctl{display:flex;gap:10px;flex-wrap:wrap}
.grp{display:flex;gap:6px;flex-wrap:wrap}
.sub{margin:6px 0 10px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.chips b{margin-left:4px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:14px}
.card{display:block;background:var(--sheet);border:1px solid var(--rule);padding:10px;color:inherit;text-decoration:none}
.card:hover{border-color:var(--ink)}
.ch{display:flex;justify-content:space-between;align-items:center;gap:6px}
.cn{font-size:12px;margin:4px 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cm{font-size:12px}
.tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
.movers{display:grid;gap:8px;margin-bottom:14px;background:var(--sheet);border:1px solid var(--rule);padding:12px}
.mv{display:grid;grid-template-columns:minmax(120px,220px) 1fr auto;gap:10px;align-items:center}
.mn{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track{position:relative;height:10px;background:var(--rule-2);border-radius:5px;overflow:hidden}
.track i{position:absolute;left:0;top:0;bottom:0;border-radius:5px}
.track .from{background:var(--rule);opacity:.9}
.track .to{height:4px;top:3px}
.track .to.up{background:var(--good)}
.track .to.dn{background:var(--strong, #c0392b)}
.mp{font-size:12px;white-space:nowrap}
.scroll{overflow-x:auto;background:var(--sheet);border:1px solid var(--rule)}
.nw{white-space:nowrap}
td .tag{margin:0 4px 3px 0}
.tk{font-weight:700}
.legend{margin-top:10px}
.legend dl{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;margin:8px 0 0}
.legend dd{margin:0}
@media (max-width:760px){
  .mv{grid-template-columns:1fr auto}
  .mv .track{grid-column:1/-1;grid-row:2}
}
</style>
