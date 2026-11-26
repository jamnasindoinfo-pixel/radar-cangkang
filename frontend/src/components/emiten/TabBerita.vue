<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../../api.js'
import { store, userRefresh } from '../../store.js'
import { fmtDate } from '../../lib/domain.js'
import { newsConclusion } from '../../lib/newsConclusion.js'
import NewsItem from '../NewsItem.vue'
import PenjelasanBursa from './PenjelasanBursa.vue'
import BeritaTerbaru from './BeritaTerbaru.vue'
import { analisaBerita } from '../../lib/beritaTerbaru.js'
import { analisaLaporan } from '../../lib/laporanAnalisa.js'

const props = defineProps({ ticker: { type: String, required: true } })
// Saham di luar radar: berita & keterbukaan terbaru diambil saat dicari (/api/berita-saham), tidak masuk feed radar.
const diRadar = computed(() => store.updates.some(u => u.ticker === props.ticker) || store.items.some(i => i.ticker === props.ticker))
const luar = ref(null), luarErr = ref(''), luarMuat = ref(false)
watch(() => [props.ticker, diRadar.value], async () => {
  luar.value = null; luarErr.value = ''
  if (diRadar.value) return
  luarMuat.value = true
  try {
    const r = await api.get('/api/berita-saham', { ticker: props.ticker })
    luar.value = r.items || []
    if (r.error) luarErr.value = r.error
  } catch (e) { luarErr.value = e.message || String(e) } finally { luarMuat.value = false }
}, { immediate: true })
const sumber = computed(() => (diRadar.value ? store.updates : luar.value || []))
const list = computed(() => sumber.value.filter(u => u.ticker === props.ticker)
  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))))
// Dikelompokkan per tanggal, sama seperti halaman Berita.
const groups = computed(() => {
  const out = []
  for (const u of list.value) {
    const d = String(u.date || '').slice(0, 10)
    let g = out[out.length - 1]
    if (!g || g.d !== d) out.push(g = { d, label: d ? fmtDate(d) : 'Tanpa tanggal', rows: [] })
    g.rows.push(u)
  }
  return out
})
const sum = computed(() => newsConclusion(list.value, { ticker: props.ticker }))

// Stockbit Reports emiten ini: tiap laporan bisa dianalisa di tempat (format Analisa berita terbaru) dan diunduh PDF.
const laporan = computed(() => list.value.filter(u => /^sb-report-/.test(String(u.id))))
const nLap = ref(10), bukaLap = ref('')
const NADA = { perhatian: ['Perlu perhatian', 't-warn'], positif: ['Positif', 't-good'], netral: ['Netral', 't-calm'] }
const label = u => analisaLaporan(u)
const busyPdf = ref(''), errPdf = ref('')
async function unduhLap(u) {
  busyPdf.value = u.id; errPdf.value = ''
  try {
    const [{ jsPDF }, mod] = await Promise.all([import('jspdf'), import('../../lib/beritaPdf.js')])
    const a = analisaBerita(u, { items: store.items, pandangan: store.pandangan, updates: sumber.value, pengendali: store.pengendali,
      relasi: store.relasi, verified: store.verified })
    ;(await mod.beritaPdf(a, jsPDF)).save(mod.beritaPdfName(a).replace(/\.pdf$/, `-${String(u.id).replace(/\D/g, '').slice(-6)}.pdf`))
  } catch (e) { errPdf.value = 'PDF gagal dibuat: ' + (e.message || e) } finally { busyPdf.value = '' }
}
// Server memperbarui berita otomatis tiap 2 jam (newsAt = waktu pembaruan terakhir).
const newsAt = computed(() => store.status?.newsAt ? new Date(store.status.newsAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '')
</script>

<template>
  <p v-if="!diRadar" class="small muted luar">{{ ticker }} di luar radar backdoor: berita dan keterbukaan terbaru diambil langsung dari Stockbit saat dicari dan tidak ditambahkan ke radar.</p>
  <p v-if="luarMuat" class="muted">Memuat berita {{ ticker }}…</p>
  <p v-else-if="luarErr && !list.length" class="muted">{{ luarErr }}</p>
  <BeritaTerbaru :ticker="ticker" :daftar="diRadar ? null : luar" />
  <PenjelasanBursa v-if="store.riDoc?.[ticker]?.penjelasanBursa" :pb="store.riDoc[ticker].penjelasanBursa" />
  <section v-if="laporan.length" class="rule-top lap">
    <div class="bar">
      <h2 class="lbl">Stockbit Reports {{ ticker }} <span class="muted small">({{ laporan.length }} laporan)</span></h2>
    </div>
    <p class="muted small">Keterbukaan resmi dari Stockbit Reports, terbaru dulu. Klik <b>Analisa</b> untuk membuka analisa laporan itu di sini, atau unduh PDF-nya.</p>
    <p v-if="errPdf" class="small c-strong">{{ errPdf }}</p>
    <ol class="ld">
      <li v-for="u in laporan.slice(0, nLap)" :key="u.id" :class="{ on: bukaLap === u.id }">
        <div class="lr">
          <span class="d">{{ fmtDate(String(u.date).slice(0, 10)) }}</span>
          <a :href="u.url" target="_blank" rel="noopener" class="lt">{{ u.title }}</a>
          <span class="tags"><span class="tag t-now">{{ label(u).jenis.nama }}</span><span class="tag" :class="NADA[label(u).nada][1]">{{ NADA[label(u).nada][0] }}</span></span>
          <span class="act">
            <button type="button" class="pill sm" :aria-expanded="String(bukaLap === u.id)" @click="bukaLap = bukaLap === u.id ? '' : u.id">{{ bukaLap === u.id ? 'Tutup' : 'Analisa' }}</button>
            <button type="button" class="pill sm" :disabled="busyPdf === u.id" @click="unduhLap(u)">{{ busyPdf === u.id ? 'Menyiapkan…' : 'Unduh PDF' }}</button>
          </span>
        </div>
        <BeritaTerbaru v-if="bukaLap === u.id" :ticker="ticker" :u="u" :daftar="diRadar ? null : luar" judul="Analisa laporan" />
      </li>
    </ol>
    <p v-if="laporan.length > nLap" class="small"><button type="button" class="pill sm" @click="nLap += 20">Tampilkan 20 lagi ({{ laporan.length - nLap }} tersisa)</button></p>
  </section>
  <section class="rule-top">
    <div class="bar">
      <h2 class="lbl">Laporan dan berita {{ ticker }}</h2>
      <button v-if="!store.status?.readOnly" type="button" class="btn" :disabled="store.busy.reports" @click="userRefresh('reports')">
        {{ store.busy.reports ? 'Memperbarui…' : 'Perbarui berita' }}
      </button>
    </div>
    <p v-if="newsAt" class="muted small">Diperbarui otomatis tiap 2 jam; pembaruan terakhir {{ newsAt }}.</p>
    <p v-if="!list.length" class="muted">Belum ada laporan atau berita untuk {{ ticker }}.</p>
    <div v-else class="sheet list">
      <div v-for="g in groups" :key="g.d">
        <h3 class="lbl gd">{{ g.label }}</h3>
        <NewsItem v-for="u in g.rows" :key="u.id" :u="u" :show-ticker="false" :daftar="diRadar ? null : luar" />
      </div>
    </div>
    <div v-if="sum" class="concl" :class="'c-' + sum.tone">
      <h3 class="lbl">Kesimpulan akhir</h3>
      <p v-for="(p, i) in sum.paras" :key="i">{{ p }}</p>
      <template v-if="sum.points.length">
        <p class="muted small">Keterbukaan material 30 hari terakhir:</p>
        <ul><li v-for="(p, i) in sum.points" :key="i">{{ p }}</li></ul>
      </template>
      <p class="verdict">{{ sum.verdict }}</p>
    </div>
    <p v-if="list.length" class="muted foot">Latar oranye = belum dilihat sejak terakhir buka. Tingkat sinyal, arah dampak, dan poin dibaca otomatis dari judul dan ringkasan. Penanda poin: segitiga naik hijau = positif bagi pemegang saham publik, segitiga turun merah = negatif atau risiko, bulat kuning = perlu dicermati.</p>
  </section>
</template>

<style scoped>
.ld{list-style:none;margin:6px 0 0;padding:0}
.ld>li{border-top:1px solid var(--rule-2);padding:6px 0}.ld>li.on{background:var(--zebra)}
.lr{display:grid;grid-template-columns:90px minmax(0,1fr) auto auto;gap:8px;align-items:center}
.lr .d{font:600 13px var(--f-display);color:var(--ink-2)}.lt{color:var(--ink);font-size:14px}
.tags{display:flex;gap:4px;flex-wrap:wrap}.act{display:flex;gap:4px}
@media (max-width:760px){.lr{grid-template-columns:80px minmax(0,1fr)}.tags,.act{grid-column:2}}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.lbl{margin:0}
.list{border-radius:4px}
.gd{margin:0;padding:10px 16px 6px;background:var(--sheet-2);border-bottom:1px solid var(--rule-2);font-family:var(--f-display);font-size:12.5px}
.small{font-size:12px;margin:0 0 8px}
.foot{margin:10px 0 0;font-size:12px}
.concl{margin-top:14px;padding:12px 14px;background:var(--sheet);border:1px solid var(--rule);border-left:3px solid var(--rule-2)}
.concl.c-now{border-left-color:var(--now-ink)}
.concl.c-warn{border-left-color:#ca8a04}
.concl h3{margin:0 0 8px}
.concl p{margin:0 0 6px;line-height:1.55}
.concl ul{margin:0 0 8px;padding-left:18px}
.concl .verdict{font-weight:600;margin:8px 0 0}
</style>
