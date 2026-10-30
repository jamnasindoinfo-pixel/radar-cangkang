<script setup>
// Seasonality: pola bulanan berulang IHSG, sektor, dan saham (5/10 tahun) + sinyal broker, katalis, dan
// alasan historis (aksi korporasi). Data dari /api/seasonality (diperbarui otomatis Senin-Sabtu pukul 00.01 WIB).
// Tampilan ringkas & interaktif: penjelasan di balik tombol "Cara membaca", sektor sebagai saringan, tabel saham
// dapat diurutkan/disaring, dan baris saham dapat dibuka untuk heatmap tahun x bulan serta trading plan.
import { computed, reactive, ref, watch } from 'vue'
import { api } from '../api.js'
import { fmt } from '../lib/domain.js'
import { useRoute, useRouter } from 'vue-router'
import BrokerPola from '../components/BrokerPola.vue'
import RecoveryPanel from '../components/RecoveryPanel.vue'
import LivePanel from '../components/LivePanel.vue'
import LowPanel from '../components/LowPanel.vue'
import TimeSeriesPanel from '../components/TimeSeriesPanel.vue'
import AstronacciPanel from '../components/AstronacciPanel.vue'
import SahamRingkas from '../components/SahamRingkas.vue'
import IhsgOutlook from '../components/IhsgOutlook.vue'
import { namaSaham } from '../lib/namaSaham.js'
import RingPct from '../components/RingPct.vue'
import { HSC_OPSI, isHsc, lolosHsc, hscInfo } from '../lib/hsc.js'

const route = useRoute(), router = useRouter()
// Tab halaman (urutan tampil): 'astro' (Astronacci), 'ts' (Time Series), 'season', 'broker' (Pola Broker), 'recovery', 'live',
// tersimpan di URL (?tab=...); tanpa ?tab = Seasonality.
const TABS = ['astro', 'ts', 'broker', 'recovery', 'low', 'live']
const tab = computed({ get: () => TABS.includes(route.query.tab) ? route.query.tab : 'season', set: v => router.replace({ query: { ...route.query, tab: TABS.includes(v) ? v : undefined } }) })
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// Default bulan depan (Desember -> Januari).
const bulan = ref((new Date().getMonth() + 1) % 12 + 1)
const tahun = ref(10)
const data = ref(null), err = ref(''), loading = ref(false)
async function load() {
  loading.value = true; err.value = ''
  try {
    const r = await api.get('/api/seasonality', { bulan: bulan.value, tahun: tahun.value })
    if (r.error) { err.value = r.error; data.value = null } else data.value = r
  } catch (e) { err.value = e.message || String(e) } finally { loading.value = false }
}
// Baris saham yang dibuka (dideklarasikan sebelum watch immediate di bawah yang mengosongkannya).
const buka = ref('')
// Kartu prioritas yang dibuka (rincian di bawah kartu).
const kartu = ref('')
watch([bulan, tahun], () => { if (tab.value === 'season') { load(); buka.value = '' } }, { immediate: true })
watch(tab, v => { if (v === 'season' && !data.value) load() })
const top5 = computed(() => (data.value?.saham || []).filter(x => lolosHsc(x.t, f.hsc)).slice(0, 5))
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 2) + '%'
const tone = p => p >= 70 ? 'c-good' : p >= 50 ? '' : 'c-strong'
const rp = v => v == null ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const rpr = e => e ? (e[0] === e[1] ? rp(e[0]) : `${rp(e[0])}–${rp(e[1])}`) : '–'
const info = ref(false)

// Garis trading plan: posisi batas rugi, area beli, TP1, TP2 pada satu skala (persentase lebar).
function planBar(p) {
  if (!p) return null
  const lo = p.sl * 0.99, hi = p.tp2 * 1.01, x = v => ((v - lo) / (hi - lo) * 100).toFixed(1) + '%'
  return { sl: x(p.sl), e0: x(p.entry[0]), e1: x(p.entry[1]), tp1: x(p.tp1), tp2: x(p.tp2), w: ((p.entry[1] - p.entry[0]) / (hi - lo) * 100).toFixed(1) + '%' }
}

// Saringan & urutan tabel saham.
const f = reactive({ sektor: '', rr: false, radar: false, broker: false, hsc: '' })
const sort = reactive({ k: 'skor', desc: true })
const SORTS = { skor: x => x.skor, prob: x => x.prob, median: x => x.median, worst: x => x.worst, beat: x => x.beatN ? x.beat / x.beatN : -1, rr: x => x.plan?.rr ?? -1 }
function sortBy(k) { if (sort.k === k) sort.desc = !sort.desc; else { sort.k = k; sort.desc = true } }
const rows = computed(() => {
  let r = data.value?.saham || []
  if (f.sektor) r = r.filter(x => x.sektor === f.sektor)
  if (f.rr) r = r.filter(x => (x.plan?.rr ?? 0) >= 1)
  if (f.radar) r = r.filter(x => x.radar)
  if (f.broker) r = r.filter(x => /akumulasi|beli/i.test(x.broker))
  if (f.hsc) r = r.filter(x => lolosHsc(x.t, f.hsc))
  const g = SORTS[sort.k]
  return [...r].sort((a, b) => (sort.desc ? g(b) - g(a) : g(a) - g(b)))
})
const arrow = k => sort.k === k ? (sort.desc ? ' ▾' : ' ▴') : ''

// Baris yang dibuka: heatmap tahun x bulan dari /api/seasonality-detail (disimpan per kode+rentang).
const detail = ref({})
async function toggle(t) {
  buka.value = buka.value === t ? '' : t
  const key = t + tahun.value
  if (buka.value && !detail.value[key]) {
    try { detail.value = { ...detail.value, [key]: await api.get('/api/seasonality-detail', { kode: t, tahun: tahun.value }) } } catch { /* abaikan */ }
  }
}
const det = t => detail.value[t + tahun.value]
const heat = v => v == null ? '' : v >= 10 ? 'h3' : v >= 3 ? 'h2' : v > 0 ? 'h1' : v <= -10 ? 'n3' : v <= -3 ? 'n2' : 'n1'
</script>

<template>
  <div class="sz">
    <header>
      <h1>Seasonality</h1>
      <div class="tabs" role="tablist" aria-label="Bagian">
        <button type="button" role="tab" class="tab" :aria-selected="tab === 'astro'" @click="tab = 'astro'">Astronacci</button>
        <button type="button" role="tab" class="tab" :aria-selected="tab === 'ts'" @click="tab = 'ts'">Time Series</button>
        <button type="button" role="tab" class="tab" :aria-selected="tab === 'season'" @click="tab = 'season'">Seasonality</button>
        <button type="button" role="tab" class="tab" :aria-selected="tab === 'broker'" @click="tab = 'broker'">Pola Broker</button>
        <button type="button" role="tab" class="tab" :aria-selected="tab === 'recovery'" @click="tab = 'recovery'">Recovery</button>
        <button type="button" role="tab" class="tab" :aria-selected="tab === 'low'" @click="tab = 'low'">Low</button>
        <button type="button" role="tab" class="tab" :aria-selected="tab === 'live'" @click="tab = 'live'"><span class="dotlive" aria-hidden="true"></span>Live</button>
      </div>
    </header>
    <AstronacciPanel v-if="tab === 'astro'" />
    <TimeSeriesPanel v-else-if="tab === 'ts'" />
    <BrokerPola v-else-if="tab === 'broker'" />
    <RecoveryPanel v-else-if="tab === 'recovery'" />
    <LowPanel v-else-if="tab === 'low'" />
    <LivePanel v-else-if="tab === 'live'" />
    <template v-else>
    <header>
      <div class="ctl">
        <div class="bln" role="group" aria-label="Bulan">
          <button v-for="(b, i) in BLN" :key="b" type="button" class="pill sm" :aria-pressed="String(bulan === i + 1)" @click="bulan = i + 1">{{ b }}</button>
        </div>
        <div class="ctl2">
          <div role="group" aria-label="Rentang">
            <button type="button" class="pill sm" :aria-pressed="String(tahun === 5)" @click="tahun = 5">5 tahun</button>
            <button type="button" class="pill sm" :aria-pressed="String(tahun === 10)" @click="tahun = 10">10 tahun</button>
          </div>
          <button type="button" class="pill sm" :aria-expanded="String(info)" @click="info = !info">ⓘ Cara membaca</button>
        </div>
      </div>
      <div v-if="info" class="info small">
        <p>Pola kenaikan berulang di bulan yang sama selama {{ tahun }} tahun: IHSG, sektor, dan saham, dipadukan dengan sinyal broker dan katalis. Probabilitas historis, bukan kepastian; bukan rekomendasi beli/jual.</p>
        <p v-if="data"><b>Skor 0–100</b> = pola saham {{ data.bobot.pola }} + sektor {{ data.bobot.sektor }} + IHSG {{ data.bobot.ihsg }} + akumulasi broker {{ data.bobot.broker }} + katalis {{ data.bobot.katalis }}. Pola memakai peluang naik terkoreksi sampel kecil (Wilson).</p>
        <p><b>Trading plan:</b> area beli = harga terkini s.d. EMA20 (maks. 5% di bawah harga); batas rugi = median penurunan di tahun-tahun turun (4–10%); TP1 = median kenaikan di tahun-tahun naik; TP2 = kenaikan kuartil atas. Uji historis memakai penutupan bulan. R/R merah = di bawah 1: tunggu harga mendekati batas bawah area beli. Jangka waktu swing ±1 bulan; posisi kecil, disiplin batas rugi; keluar lebih awal bila TP tercapai atau pola bulan ini gagal di pekan pertama.</p>
        <p><b>Interaksi:</b> klik batang bulan untuk ganti bulan, klik sektor untuk menyaring saham, klik judul kolom untuk mengurutkan, dan klik baris saham untuk heatmap tahun × bulan.</p>
      </div>
    </header>

    <p v-if="loading" class="muted">Menghitung pola…</p>
    <p v-else-if="err" class="muted">{{ err }}</p>
    <template v-else-if="data">
      <!-- Pasar: IHSG bulan terpilih + peluang naik 12 bulan (klik untuk ganti bulan). -->
      <section class="rule-top">
        <div class="mh">
          <h2>Pasar (IHSG) · {{ BLN[bulan - 1] }}</h2>
          <span v-if="data.ihsg" class="small muted">naik {{ data.ihsg.up }}/{{ data.ihsg.n }} tahun · median {{ pct(data.ihsg.median) }}</span>
        </div>
        <div class="months">
          <button v-for="(m, i) in data.ihsgBulan" :key="i" type="button" class="mo" :class="{ on: bulan === i + 1 }" :title="m ? `${BLN[i]}: naik ${Math.round(m.prob * m.n / 100)}/${m.n} tahun, median ${pct(m.median)}` : ''" @click="bulan = i + 1">
            <span class="bar"><i :style="{ height: (m?.prob || 0) + '%' }" :class="tone(m?.prob || 0)" /></span>
            <b>{{ m ? m.prob + '%' : '–' }}</b><small>{{ BLN[i] }}</small>
          </button>
        </div>
      </section>

      <!-- Kondisi IHSG sekarang: tren, support/resistance, sentimen, dan probabilitas pola bulan ini berulang. -->
      <IhsgOutlook :bulan="bulan" :nama-bulan="BLN[bulan - 1]" />

      <!-- Prioritas: cincin peluang + garis trading plan; klik kartu untuk rincian (alasan + trading plan). -->
      <section class="rule-top">
        <h2>Prioritas {{ BLN[bulan - 1] }}</h2>
        <div class="cards">
          <button v-for="x in top5" :key="x.t" type="button" class="card" :class="{ on: kartu === x.t }" :aria-expanded="String(kartu === x.t)" @click="kartu = kartu === x.t ? '' : x.t">
            <div class="ch">
              <RingPct :v="x.prob" :size="50" label="Peluang naik" />
              <div class="cht"><b>{{ x.t }}</b><span class="small muted">{{ x.nama || namaSaham(x.t) || x.sektorNama || 'sektor –' }}</span></div>
              <span class="skor" title="Skor prioritas 0–100">{{ x.skor }}</span>
            </div>
            <span class="small">Naik <b>{{ x.up }}/{{ x.n }}</b> · median <b>{{ pct(x.median) }}</b> · broker {{ x.broker }}<template v-if="x.radar"> · {{ x.radar }}</template></span>
            <template v-if="x.plan">
              <div class="pb" :title="`Batas rugi ${rp(x.plan.sl)} · beli ${rpr(x.plan.entry)} · TP ${rp(x.plan.tp1)}/${rp(x.plan.tp2)}`">
                <i class="pz" :style="{ left: planBar(x.plan).e0, width: planBar(x.plan).w }" />
                <i class="mk sl" :style="{ left: planBar(x.plan).sl }" /><i class="mk tp" :style="{ left: planBar(x.plan).tp1 }" /><i class="mk tp" :style="{ left: planBar(x.plan).tp2 }" />
              </div>
              <div class="pl small"><span class="c-strong">SL {{ rp(x.plan.sl) }}</span><span>Beli {{ rpr(x.plan.entry) }}</span><span class="c-good">TP {{ rp(x.plan.tp1) }}/{{ rp(x.plan.tp2) }}</span></div>
              <span class="small muted">R/R <b :class="{ 'c-strong': x.plan.rr != null && x.plan.rr < 1 }">{{ x.plan.rr ?? '–' }}</b> · {{ x.plan.timeframe }} · uji TP1 {{ x.plan.kenaTp1 }}/{{ x.plan.n }}, SL {{ x.plan.kenaSl }}/{{ x.plan.n }}</span>
            </template>
            <span v-if="x.alasan[0]" class="small muted ell" :title="x.alasan.join(' · ')">{{ x.alasan[0] }}</span>
          </button>
        </div>
        <div v-if="kartu" class="kp"><SahamRingkas :kode="kartu" :bulan="bulan" /></div>
        <!-- Tabel trading plan lengkap tetap tersedia. -->
        <details v-if="top5.some(x => x.plan)" class="tpd">
          <summary class="small">Tabel trading plan {{ BLN[bulan - 1] }} (waktu masuk/keluar & uji historis)</summary>
          <div class="scroll">
            <table class="ledger">
              <thead><tr><th>Saham</th><th class="num">Harga</th><th>Area beli</th><th class="num">Batas rugi</th><th class="num">TP1</th><th class="num">TP2</th><th class="num">R/R</th><th>Masuk</th><th>Keluar</th><th class="num">Uji historis</th></tr></thead>
              <tbody>
                <tr v-for="x in top5.filter(y => y.plan)" :key="x.t">
                  <td><RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }"><b>{{ x.t }}</b></RouterLink>
                    <div v-if="x.nama || namaSaham(x.t)" class="small muted nm">{{ x.nama || namaSaham(x.t) }}</div></td>
                  <td class="num">{{ rp(x.plan.harga) }}</td>
                  <td>{{ rpr(x.plan.entry) }}</td>
                  <td class="num c-strong">{{ rp(x.plan.sl) }} <span class="small">({{ x.plan.slPct }}%)</span></td>
                  <td class="num c-good">{{ rp(x.plan.tp1) }} <span class="small">(+{{ x.plan.tp1Pct }}%)</span></td>
                  <td class="num c-good">{{ rp(x.plan.tp2) }} <span class="small">(+{{ x.plan.tp2Pct }}%)</span></td>
                  <td class="num" :class="{ 'c-strong': x.plan.rr != null && x.plan.rr < 1 }">{{ x.plan.rr ?? '–' }}</td>
                  <td class="small">{{ x.plan.masuk }}</td>
                  <td class="small">{{ x.plan.keluar }}</td>
                  <td class="num small">TP1 {{ x.plan.kenaTp1 }}/{{ x.plan.n }} · SL {{ x.plan.kenaSl }}/{{ x.plan.n }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <!-- Sektor: klik untuk menyaring tabel saham. -->
      <section class="rule-top">
        <div class="mh"><h2>Sektor · {{ BLN[bulan - 1] }}</h2><span class="small muted">klik untuk menyaring saham</span></div>
        <div class="sek">
          <button v-for="s in data.sektor" :key="s.kode" type="button" class="sr" :class="{ on: f.sektor === s.kode }" :aria-pressed="String(f.sektor === s.kode)" @click="f.sektor = f.sektor === s.kode ? '' : s.kode">
            <span>{{ s.nama }}</span>
            <span class="track"><i :style="{ width: s.prob + '%' }" :class="tone(s.prob)" /></span>
            <b :class="tone(s.prob)">{{ s.prob }}%</b>
            <span class="small muted">{{ s.up }}/{{ s.n }} · {{ pct(s.median) }}</span>
          </button>
        </div>
      </section>

      <section class="rule-top">
        <div class="mh">
          <h2>Saham berpola naik di {{ BLN[bulan - 1] }}</h2>
          <span class="small muted">{{ rows.length }} dari {{ data.total }} saham · data {{ data.updated }}</span>
        </div>
        <div class="flt" role="group" aria-label="Saringan">
          <button v-if="f.sektor" type="button" class="pill sm" aria-pressed="true" @click="f.sektor = ''">{{ data.sektor.find(s => s.kode === f.sektor)?.nama }} ✕</button>
          <button type="button" class="pill sm" :aria-pressed="String(f.rr)" @click="f.rr = !f.rr">R/R ≥ 1</button>
          <button type="button" class="pill sm" :aria-pressed="String(f.broker)" @click="f.broker = !f.broker">Broker akumulasi</button>
          <button type="button" class="pill sm" :aria-pressed="String(f.radar)" @click="f.radar = !f.radar">Radar / Kandidat</button>
          <span class="hscg" role="group" aria-label="Saham HSC" :title="hscInfo()">
            <span class="small muted">HSC:</span>
            <button v-for="[v, l] in HSC_OPSI" :key="v" type="button" class="pill sm" :aria-pressed="String(f.hsc === v)" @click="f.hsc = v">{{ l }}</button>
          </span>
        </div>
        <div class="scroll">
          <table class="ledger st">
            <thead><tr>
              <th>Saham</th><th>Sektor</th>
              <th class="num srt" @click="sortBy('prob')">Peluang{{ arrow('prob') }}</th>
              <th class="num srt" @click="sortBy('median')">Median{{ arrow('median') }}</th>
              <th class="num srt" @click="sortBy('worst')">Terburuk{{ arrow('worst') }}</th>
              <th class="num srt" @click="sortBy('beat')">&gt; IHSG{{ arrow('beat') }}</th>
              <th>Broker</th>
              <th class="num srt" @click="sortBy('rr')">R/R{{ arrow('rr') }}</th>
              <th class="num srt" @click="sortBy('skor')">Skor{{ arrow('skor') }}</th>
            </tr></thead>
            <tbody>
              <template v-for="x in rows" :key="x.t">
                <tr class="row" :class="{ open: buka === x.t }" tabindex="0" @click="toggle(x.t)" @keydown.enter="toggle(x.t)">
                  <td><span class="car">{{ buka === x.t ? '▾' : '▸' }}</span> <b>{{ x.t }}</b><span v-if="isHsc(x.t)" class="tag t-warn" title="Saham HSC: dikeluarkan dari perhitungan IHSG">HSC</span><span v-if="x.radar" class="tag t-calm">{{ x.radar }}</span><span v-if="x.katalis.length" class="tag t-warn" :title="x.katalis.map(k => k.jenis + ' ' + k.tanggal).join(', ')">katalis</span>
                    <div v-if="x.nama || namaSaham(x.t)" class="small muted nm">{{ x.nama || namaSaham(x.t) }}</div></td>
                  <td class="small">{{ x.sektorNama || '–' }}</td>
                  <td class="num" :class="tone(x.prob)"><span class="minibar"><i :style="{ width: x.prob + '%' }" :class="tone(x.prob)" /></span>{{ x.up }}/{{ x.n }}</td>
                  <td class="num">{{ pct(x.median) }}</td>
                  <td class="num">{{ pct(x.worst) }}</td>
                  <td class="num">{{ x.beatN ? x.beat + '/' + x.beatN : '–' }}</td>
                  <td class="small">{{ x.broker }}</td>
                  <td class="num" :class="{ 'c-strong': x.plan?.rr != null && x.plan.rr < 1 }">{{ x.plan?.rr ?? '–' }}</td>
                  <td class="num"><b>{{ x.skor }}</b></td>
                </tr>
                <tr v-if="buka === x.t" class="xd">
                  <td colspan="9">
                    <SahamRingkas :kode="x.t" :bulan="bulan" :plan="false" />
                    <div class="xg">
                      <div>
                        <h4>Heatmap {{ x.t }} · return bulanan (%)</h4>
                        <p v-if="!det(x.t)" class="small muted">Memuat…</p>
                        <div v-else class="scroll">
                          <table class="hm">
                            <thead><tr><th></th><th v-for="(b, i) in BLN" :key="b" :class="{ cur: i + 1 === bulan }">{{ b }}</th></tr></thead>
                            <tbody>
                              <tr v-for="y in det(x.t).tahun" :key="y"><th>{{ y }}</th>
                                <td v-for="m in 12" :key="m" :class="[heat(det(x.t).heat[y]?.[m]), { cur: m === bulan }]">{{ det(x.t).heat[y]?.[m] != null ? fmt(det(x.t).heat[y][m], 1) : '' }}</td>
                              </tr>
                              <tr class="pr"><th>Naik</th><td v-for="(p, i) in det(x.t).bulan" :key="i" :class="{ cur: i + 1 === bulan }">{{ p ? p.prob + '%' : '' }}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div class="small">
                        <h4>Trading plan</h4>
                        <dl v-if="x.plan" class="tp">
                          <dt>Harga</dt><dd>{{ rp(x.plan.harga) }}</dd>
                          <dt>Beli</dt><dd>{{ rpr(x.plan.entry) }}</dd>
                          <dt>Batas rugi</dt><dd class="c-strong">{{ rp(x.plan.sl) }} ({{ x.plan.slPct }}%)</dd>
                          <dt>TP1 / TP2</dt><dd class="c-good">{{ rp(x.plan.tp1) }} / {{ rp(x.plan.tp2) }}</dd>
                          <dt>R/R</dt><dd>{{ x.plan.rr ?? '–' }}</dd>
                          <dt>Masuk</dt><dd>{{ x.plan.masuk }}</dd>
                          <dt>Keluar</dt><dd>{{ x.plan.keluar }}</dd>
                          <dt>Uji historis</dt><dd>TP1 {{ x.plan.kenaTp1 }}/{{ x.plan.n }} · SL {{ x.plan.kenaSl }}/{{ x.plan.n }}</dd>
                        </dl>
                        <p v-else class="muted">Harga belum tersedia.</p>
                        <h4>Katalis & alasan historis</h4>
                        <ul>
                          <li v-for="k in x.katalis" :key="k.tanggal + k.jenis">Akan datang: {{ k.jenis }} {{ k.tanggal }}</li>
                          <li v-for="a in x.alasan" :key="a">{{ a }}</li>
                          <li v-if="!x.katalis.length && !x.alasan.length" class="muted">Tidak ada.</li>
                        </ul>
                        <p class="muted">Komponen skor: pola {{ x.komponen.pola }} · sektor {{ x.komponen.sektor }} · IHSG {{ x.komponen.ihsg }} · broker {{ x.komponen.broker }} · katalis {{ x.komponen.katalis }}</p>
                        <RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }">Buka analisa {{ x.t }} ›</RouterLink>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>
    </template>
    </template>
  </div>
</template>

<style scoped>
.sz header{margin-bottom:8px}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--rule);margin:4px 0 8px}
.tab{background:none;border:0;border-bottom:3px solid transparent;padding:6px 12px;font:inherit;font-weight:600;cursor:pointer;color:var(--muted)}
.tab[aria-selected=true]{border-bottom-color:var(--now-ink);color:inherit}
.ctl{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;align-items:center}
.ctl2{display:flex;gap:8px;flex-wrap:wrap}
.bln{display:flex;gap:4px;flex-wrap:wrap}
.info{border:1px solid var(--rule);background:var(--sheet);padding:8px 12px;margin-top:8px}.info p{margin:4px 0}
.mh{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.mh h2{margin:0}
.months{display:grid;grid-template-columns:repeat(12,1fr);gap:6px;margin-top:6px}
.mo{display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:1px solid transparent;padding:4px 0;cursor:pointer;font:inherit;color:inherit;transition:background .2s}
.mo:hover{background:var(--sheet)}.mo.on{border-color:var(--now-ink)}
.mo .bar{height:60px;width:60%;background:var(--rule);display:flex;align-items:flex-end}
.mo .bar i{display:block;width:100%;background:var(--strong);transition:height .5s ease}.mo .bar i.c-good{background:var(--good)}.mo .bar i:not(.c-good):not(.c-strong){background:var(--warn,#c79a1a)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
.card{display:flex;flex-direction:column;gap:5px;border:1px solid var(--rule);border-top:4px solid var(--good);padding:10px 12px;background:var(--sheet);color:inherit;text-decoration:none;transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.08)}
.ch{display:flex;gap:10px;align-items:center}.cht{display:flex;flex-direction:column;flex:1}.cht b{font-size:20px}.skor{font-weight:700;color:var(--good);font-size:18px}
.pb{position:relative;height:10px;background:var(--rule);border-radius:5px;margin-top:4px}
.pb .pz{position:absolute;top:0;bottom:0;background:#0d9488;opacity:.6;border-radius:5px;min-width:3px}
.pb .mk{position:absolute;top:-3px;width:3px;height:16px;border-radius:2px}.pb .sl{background:var(--strong)}.pb .tp{background:var(--good)}
.pl{display:flex;justify-content:space-between;gap:6px}
.ell{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tpd{margin-top:8px}.tpd summary{cursor:pointer}
.sek{display:grid;gap:4px;max-width:780px;margin-top:6px}
.sr{display:grid;grid-template-columns:190px 1fr 50px 110px;gap:10px;align-items:center;background:none;border:1px solid transparent;padding:3px 6px;font:inherit;color:inherit;cursor:pointer;text-align:left}
.sr:hover{background:var(--sheet)}.sr.on{border-color:var(--now-ink);background:var(--sheet)}
.track{height:12px;background:var(--rule);border-radius:6px;overflow:hidden}.track i{display:block;height:100%;background:var(--strong);transition:width .5s ease}.track i.c-good{background:var(--good)}.track i:not(.c-good):not(.c-strong){background:var(--warn,#c79a1a)}
.flt{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
.tag{margin-left:6px}
.hscg{display:inline-flex;align-items:center;gap:4px;margin-left:8px}
.srt{cursor:pointer;user-select:none}.srt:hover{text-decoration:underline}
.row{cursor:pointer}.row:hover,.row.open{background:var(--sheet)}.car{color:var(--muted);font-size:11px}
.minibar{display:inline-block;width:40px;height:6px;background:var(--rule);border-radius:3px;margin-right:6px;vertical-align:middle;overflow:hidden}
.minibar i{display:block;height:100%;background:var(--strong)}.minibar i.c-good{background:var(--good)}.minibar i:not(.c-good):not(.c-strong){background:var(--warn,#c79a1a)}
.xd td{background:var(--sheet);padding:10px 12px}
.xg{display:grid;grid-template-columns:minmax(0,2fr) minmax(220px,1fr);gap:16px}
.xg h4{margin:0 0 4px;font-size:12px;text-transform:uppercase}
.hm{border-collapse:collapse;font-size:11px}.hm th,.hm td{padding:2px 5px;text-align:right;border:1px solid var(--rule)}
.hm .cur{outline:2px solid var(--now-ink);outline-offset:-2px}
.hm .h1{background:#d9f2e3}.hm .h2{background:#a7dfbd}.hm .h3{background:#5fbf86;color:#fff}
.hm .n1{background:#f8dcdc}.hm .n2{background:#eeaaaa}.hm .n3{background:#d65c5c;color:#fff}
.hm .pr td{font-weight:700}
.tp{display:grid;grid-template-columns:auto 1fr;gap:1px 8px;margin:0 0 6px}.tp dt{color:var(--muted)}.tp dd{margin:0;font-weight:600}
.xg ul{margin:0 0 6px;padding-left:16px}
@media (max-width:800px){.xg{grid-template-columns:1fr}}
@media (max-width:700px){.months{grid-template-columns:repeat(6,1fr)}.sr{grid-template-columns:1fr 1fr 44px}.sr .small{display:none}}
button.card{text-align:left;font:inherit;color:inherit;cursor:pointer}.card.on{outline:2px solid var(--now-ink)}.kp{border:1px solid var(--rule);background:var(--sheet);padding:6px 12px;margin-top:10px}
.dotlive{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--good);margin-right:6px;vertical-align:middle;animation:kedip 1.6s infinite}
@keyframes kedip{50%{opacity:.25}}
.nm{max-width:26ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}
</style>
