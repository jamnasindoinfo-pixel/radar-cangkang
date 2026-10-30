<script setup>
// Pola Broker: akumulasi/distribusi per broker per bulan (tahun berjalan) dari /api/broker-pola.
// Dua tampilan: per saham (agregat semua broker pada bulan terpilih) dan per broker (bulan demi bulan).
import { computed, ref, watch } from 'vue'
import { api } from '../api.js'
import { big, fmt } from '../lib/domain.js'
import { h } from 'vue'
import { HSC_OPSI, isHsc, lolosHsc, hscInfo } from '../lib/hsc.js'
import SahamRingkas from './SahamRingkas.vue'
import { namaSaham } from '../lib/namaSaham.js'

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const bulan = ref(new Date().getMonth() + 1)
const jenis = ref('')            // '' | 'asing' | 'domestik'
const mode = ref('saham')        // 'saham' | 'broker'
const broker = ref('')
// Per saham: periode bulanan (tahun berjalan) atau harian (20 hari bursa terakhir, data setelah bursa tutup).
const periode = ref('bulanan')   // 'bulanan' | 'harian'
const tanggal = ref('')
const harian = computed(() => mode.value === 'saham' && periode.value === 'harian')
const HR = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const tgl = d => { const x = new Date(d + 'T00:00:00'); return `${HR[x.getDay()]} ${x.getDate()} ${BLN[x.getMonth()]}` }
const data = ref(null), err = ref(''), loading = ref(false)
async function load() {
  loading.value = true; err.value = ''
  try {
    const r = await api.get('/api/broker-pola', harian.value ? { harian: 1, tanggal: tanggal.value, jenis: jenis.value }
      : { bulan: bulan.value, jenis: jenis.value, broker: mode.value === 'broker' ? broker.value : '' })
    if (r.error) { err.value = r.error; data.value = null } else {
      data.value = r
      if (r.harian && r.tanggal && tanggal.value !== r.tanggal) tanggal.value = r.tanggal
      if (!broker.value && r.brokers?.length) broker.value = r.brokers[0].kode
    }
  } catch (e) { err.value = e.message || String(e) } finally { loading.value = false }
}
watch([bulan, jenis, mode, broker, periode], load, { immediate: true })
watch(tanggal, (v, old) => { if (old && harian.value) load() })
// Judul periode untuk grafik & tabel.
const judul = computed(() => harian.value ? (data.value?.tanggal ? tgl(data.value.tanggal) + ' ' + data.value.tanggal.slice(0, 4) : '') : `${BLN[bulan.value - 1]} ${data.value?.tahun || ''}`)
const lblSeri = p => p.tanggal ? `${+p.tanggal.slice(8)}/${+p.tanggal.slice(5, 7)}` : BLN[p.bulan - 1]

// Grafik: batang dua arah (akumulasi kanan, distribusi kiri) untuk bulan terpilih; klik saham -> grafik bulanan.
const hsc = ref('')              // '' | 'tanpa' | 'hanya' (saham HSC, lib/hsc.js)
// Daftar saham per bulan setelah saringan HSC.
const saham = computed(() => {
  const s = data.value?.saham
  return s ? { akumulasi: s.akumulasi.filter(x => lolosHsc(x.s, hsc.value)), distribusi: s.distribusi.filter(x => lolosHsc(x.s, hsc.value)) } : null
})
const pilih = ref('')
// Baris tabel yang dibuka untuk rincian saham (kunci = sisi/bulan + kode).
const bukaB = ref('')
const togel = k => { bukaB.value = bukaB.value === k ? '' : k }
const seri = ref(null)
const bars = computed(() => {
  const s = saham.value
  if (!s) return null
  const ak = s.akumulasi.slice(0, 10), di = s.distribusi.slice(0, 10)
  const max = Math.max(1, ...ak.map(x => x.bandar), ...di.map(x => -x.bandar))
  return { ak, di, w: v => Math.max(2, Math.abs(v) / max * 100) + '%' }
})
watch(saham, s => { if (s && !s.akumulasi.some(x => x.s === pilih.value) && !s.distribusi.some(x => x.s === pilih.value)) pilih.value = s.akumulasi[0]?.s || '' })
watch([pilih, jenis, harian], async ([t]) => {
  seri.value = null
  if (!t) return
  try { seri.value = await api.get('/api/broker-pola', { saham: t, jenis: jenis.value, harian: harian.value ? 1 : '' }) } catch { /* abaikan */ }
})
const SW = 720, SH = 200, SP = 24
const sChart = computed(() => {
  const r = seri.value?.seri
  if (!r?.length) return null
  const maxB = Math.max(1, ...r.map(x => Math.abs(x.bandar)))
  const avgs = r.map(x => x.bandar >= 0 ? x.avgAkum : x.avgDist).filter(Boolean)
  const lo = Math.min(...avgs) * 0.98, hi = Math.max(...avgs) * 1.02
  const bw = (SW - 2 * SP) / r.length, mid = SH / 2
  const pts = r.map((x, i) => {
    const a = x.bandar >= 0 ? x.avgAkum : x.avgDist
    return { ...x, a, cx: SP + i * bw + bw / 2, h: Math.abs(x.bandar) / maxB * (mid - 14), ay: a ? SH - 10 - (a - lo) / (hi - lo || 1) * (SH - 30) : null }
  })
  const line = pts.filter(p => p.ay != null).map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.ay.toFixed(1)}`).join('')
  return { pts, bw, mid, line }
})

const rp = v => v == null ? '–' : (v < 0 ? '−' : '') + 'Rp' + big(Math.abs(v)).replace(/^Rp/, '')
const lot = v => v == null ? '–' : (v < 0 ? '−' : '') + fmt(Math.abs(v), 0)
const avg = v => v == null ? '–' : 'Rp' + fmt(v, v < 200 ? 1 : 0)
const brokerList = computed(() => (data.value?.brokers || []).filter(b => !jenis.value || (jenis.value === 'asing') === (b.jenis === 'Asing')))
const B = computed(() => data.value?.broker || null)
const bulanB = computed(() => B.value ? Object.entries(B.value.bulan).map(([m, x]) => ({ m: +m, ...x })).sort((a, b) => b.m - a.m) : [])
// Tanda potensi repo: kuat (keterbukaan bertujuan repo/gadai) atau crossing nego broker yang sama; alasan di tooltip & teks.
const RepoTag = props => props.r
  ? h('span', { title: props.r.alasan.join(' · ') }, [h('span', { class: 'tag ' + (props.r.kuat ? 't-strong' : 't-warn') }, props.r.kuat ? 'Potensi repo (keterbukaan)' : 'Potensi repo (crossing nego)'), h('div', { class: 'muted' }, props.r.alasan[0])])
  : h('span', { class: 'muted' }, 'Bukan')
RepoTag.props = ['r']
const tag = j => j === 'Asing' ? 't-calm' : j === 'Pemerintah' ? 't-warn' : 't-good'
</script>

<template>
  <div class="bp">
    <p class="muted small">Akumulasi (net beli) dan distribusi (net jual) tiap broker per bulan tahun {{ data?.tahun || new Date().getFullYear() }} atau per hari (20 hari bursa terakhir, diperbarui tiap hari bursa setelah 16.45 WIB): saham, net lot, net nominal, dan harga rata-rata beli/jual. Sumber: broker activity Stockbit, pasar reguler. Diperbarui otomatis Senin–Sabtu pukul 00.01 WIB.</p>
    <div class="ctl">
      <div role="group" aria-label="Tampilan">
        <button type="button" class="pill sm" :aria-pressed="String(mode === 'saham')" @click="mode = 'saham'">Per saham</button>
        <button type="button" class="pill sm" :aria-pressed="String(mode === 'broker')" @click="mode = 'broker'">Per broker</button>
      </div>
      <div role="group" aria-label="Jenis broker">
        <button type="button" class="pill sm" :aria-pressed="String(jenis === '')" @click="jenis = ''">Semua</button>
        <button type="button" class="pill sm" :aria-pressed="String(jenis === 'asing')" @click="jenis = 'asing'">Asing</button>
        <button type="button" class="pill sm" :aria-pressed="String(jenis === 'domestik')" @click="jenis = 'domestik'">Domestik</button>
      </div>
      <div role="group" aria-label="Saham HSC" :title="hscInfo()">
        <span class="small muted">HSC:</span>
        <button v-for="[v, l] in HSC_OPSI" :key="v" type="button" class="pill sm" :aria-pressed="String(hsc === v)" @click="hsc = v">{{ l }}</button>
      </div>
    </div>
    <div v-if="mode === 'saham'" class="bln" role="group" aria-label="Periode">
      <button type="button" class="pill sm" :aria-pressed="String(periode === 'bulanan')" @click="periode = 'bulanan'">Bulanan</button>
      <button type="button" class="pill sm" :aria-pressed="String(periode === 'harian')" @click="periode = 'harian'">Harian</button>
    </div>
    <div v-if="harian" class="bln" role="group" aria-label="Tanggal">
      <button v-for="d in data?.tanggalAda || []" :key="d" type="button" class="pill sm" :aria-pressed="String(tanggal === d)" @click="tanggal = d">{{ tgl(d) }}</button>
    </div>
    <div v-else-if="mode === 'saham'" class="bln" role="group" aria-label="Bulan">
      <button v-for="(b, i) in BLN" :key="b" type="button" class="pill sm" :disabled="data && !data.bulanAda?.includes(i + 1)" :aria-pressed="String(bulan === i + 1)" @click="bulan = i + 1">{{ b }}</button>
    </div>
    <label v-else class="small">Broker
      <select v-model="broker" class="field">
        <option v-for="b in brokerList" :key="b.kode" :value="b.kode">{{ b.kode }} · {{ b.nama }} ({{ b.jenis }})</option>
      </select>
    </label>

    <p v-if="loading" class="muted">Memuat pola broker…</p>
    <p v-else-if="err" class="muted">{{ err }}</p>
    <template v-else-if="data">
      <!-- Per saham: agregat semua broker (sesuai filter) pada bulan terpilih. -->
      <template v-if="mode === 'saham' && data.saham">
        <!-- Grafik batang dua arah: 10 saham paling diakumulasi (kanan, hijau) dan didistribusi (kiri, merah). -->
        <div v-if="bars" class="gr">
          <div class="dv">
            <div class="col">
              <h4 class="c-strong">Distribusi</h4>
              <button v-for="x in bars.di" :key="x.s" type="button" class="bb l" :class="{ on: pilih === x.s }" :title="`${x.s}${namaSaham(x.s) ? ' (' + namaSaham(x.s) + ')' : ''}: ${rp(x.bandar)} · avg ${avg(x.avgDist)} · ${x.dist.map(z => z.b).join(', ')}`" @click="pilih = x.s">
                <span class="v small">{{ rp(x.bandar) }}</span><i :style="{ width: bars.w(x.bandar) }" /><b>{{ x.s }}</b>
              </button>
            </div>
            <div class="col">
              <h4 class="c-good">Akumulasi</h4>
              <button v-for="x in bars.ak" :key="x.s" type="button" class="bb r" :class="{ on: pilih === x.s }" :title="`${x.s}${namaSaham(x.s) ? ' (' + namaSaham(x.s) + ')' : ''}: ${rp(x.bandar)} · avg ${avg(x.avgAkum)} · ${x.akum.map(z => z.b).join(', ')}`" @click="pilih = x.s">
                <b>{{ x.s }}</b><i :style="{ width: bars.w(x.bandar) }" /><span class="v small">{{ rp(x.bandar) }}</span>
              </button>
            </div>
          </div>
          <!-- Grafik bulanan saham terpilih: net bandar per bulan (batang) + avg broker (garis). -->
          <div v-if="pilih" class="mc">
            <h4>{{ pilih }} · net bandar per {{ harian ? 'hari (20 hari bursa terakhir)' : 'bulan ' + data.tahun }} <span class="muted small">(klik batang saham di kiri untuk ganti)</span></h4>
            <p v-if="!sChart" class="small muted">Memuat…</p>
            <svg v-else :viewBox="`0 0 ${SW} ${SH}`" class="msvg" role="img" :aria-label="'Net bandar bulanan ' + pilih">
              <line :x1="SP" :x2="SW - SP" :y1="sChart.mid" :y2="sChart.mid" class="ax" />
              <g v-for="p in sChart.pts" :key="p.bulan || p.tanggal">
                <rect :x="p.cx - sChart.bw * 0.32" :width="sChart.bw * 0.64" :y="p.bandar >= 0 ? sChart.mid - p.h : sChart.mid" :height="Math.max(1, p.h)" :class="p.bandar >= 0 ? 'up' : 'dn'">
                  <title>{{ p.tanggal ? tgl(p.tanggal) : BLN[p.bulan - 1] }}: {{ rp(p.bandar) }} · avg {{ avg(p.a) }} · {{ (p.bandar >= 0 ? p.akum : p.dist).join(', ') }} · asing {{ rp(p.asing) }}, domestik {{ rp(p.domestik) }}</title>
                </rect>
                <text :x="p.cx" :y="SH - 2" text-anchor="middle" class="lb">{{ lblSeri(p) }}</text>
              </g>
              <path :d="sChart.line" class="avl" />
              <circle v-for="p in sChart.pts.filter(q => q.ay != null)" :key="'c' + (p.bulan || p.tanggal)" :cx="p.cx" :cy="p.ay" r="3" class="avd"><title>avg broker {{ avg(p.a) }}</title></circle>
            </svg>
            <p class="small muted leg"><span class="k up" /> akumulasi <span class="k dn" /> distribusi <span class="k av" /> avg broker · arahkan kursor ke batang untuk rincian broker, avg, Asing/Domestik</p>
            <SahamRingkas :kode="pilih" />
          </div>
        </div>

        <!-- Akumulasi (kiri) dan distribusi (kanan); peringkat = net 3 broker pembeli teratas + 3 penjual teratas. -->
        <div class="lr">
          <section v-for="side in [['akumulasi', 'Akumulasi', 'c-good', 'akum', 'avgAkum'], ['distribusi', 'Distribusi', 'c-strong', 'dist', 'avgDist']]" :key="side[0]">
            <h3 :class="side[2]">{{ side[1] }} · {{ judul }}</h3>
            <table class="ledger cmp">
              <thead><tr><th>Saham</th><th class="num">Net bandar</th><th class="num">Lot</th><th class="num">Avg broker</th><th>Broker utama</th><th class="num">Asing / Dom.</th></tr></thead>
              <tbody>
                <template v-for="x in saham[side[0]].slice(0, 25)" :key="x.s">
                <tr class="row" :class="{ open: bukaB === side[0] + x.s }" tabindex="0" @click="togel(side[0] + x.s)" @keydown.enter="togel(side[0] + x.s)">
                  <td><span class="car">{{ bukaB === side[0] + x.s ? '▾' : '▸' }}</span> <b>{{ x.s }}</b>
                    <span v-if="isHsc(x.s)" class="tag t-warn" title="Saham HSC: dikeluarkan dari perhitungan IHSG">HSC</span>
                    <span v-if="x.repo" class="tag repo" :class="x.repo.kuat ? 't-strong' : 't-warn'" :title="x.repo.alasan.join(' · ')">repo?</span>
                    <div v-if="namaSaham(x.s)" class="small muted nm">{{ namaSaham(x.s) }}</div></td>
                  <td class="num" :class="side[2]">{{ rp(x.bandar) }}</td>
                  <td class="num">{{ lot(x.bandarLot) }}</td>
                  <td class="num"><b>{{ avg(x[side[4]]) }}</b></td>
                  <td class="small"><span v-for="z in x[side[3]]" :key="z.b" class="bk" :title="`${z.b}: ${rp(z.val)}, ${lot(z.lot)} lot @${avg(z.avg)}`">{{ z.b }}<sup>{{ avg(z.avg).replace('Rp', '') }}</sup></span></td>
                  <td class="num small"><span :class="x.asing >= 0 ? 'c-good' : 'c-strong'">{{ rp(x.asing) }}</span><br><span :class="x.domestik >= 0 ? 'c-good' : 'c-strong'">{{ rp(x.domestik) }}</span></td>
                </tr>
                <tr v-if="bukaB === side[0] + x.s" class="det"><td colspan="6"><SahamRingkas :kode="x.s" /></td></tr>
                </template>
              </tbody>
            </table>
          </section>
        </div>
        <p class="muted small">Net bandar = net beli 3 broker pembeli teratas + net jual 3 broker penjual teratas (gaya Bandar Detector). Avg broker = harga rata-rata gabungan broker utama (tertimbang nilai); angka kecil di samping kode broker = avg masing-masing. Label repo? = potensi repo (arahkan kursor untuk alasannya).</p>
      </template>

      <!-- Per broker: bulan demi bulan, akumulasi dan distribusi terbesar. -->
      <template v-else-if="mode === 'broker' && B">
        <h3>{{ B.kode }} · {{ B.nama }} <span class="tag" :class="tag(B.jenis)">{{ B.jenis }}</span></h3>
        <details v-for="(x, k) in bulanB" :key="x.m" class="mo" :open="k === 0">
          <summary><b>{{ BLN[x.m - 1] }} {{ data.tahun }}</b> <span class="muted small">s.d. {{ x.sampai }} · transaksi {{ rp(x.gross) }}</span></summary>
          <div class="two">
            <section v-for="side in [['beli', 'Akumulasi', 'c-good', 'avgB'], ['jual', 'Distribusi', 'c-strong', 'avgS']]" :key="side[0]">
              <h4 :class="side[2]">{{ side[1] }}</h4>
              <table class="ledger">
                <thead><tr><th>Saham</th><th class="num">Net lot</th><th class="num">Net nominal</th><th class="num">Avg {{ side[0] }}</th><th>Potensi repo</th></tr></thead>
                <tbody>
                  <template v-for="r in x[side[0]].filter(r => lolosHsc(r.s, hsc)).slice(0, 15)" :key="r.s">
                  <tr class="row" :class="{ open: bukaB === x.m + side[0] + r.s }" tabindex="0" @click="togel(x.m + side[0] + r.s)" @keydown.enter="togel(x.m + side[0] + r.s)">
                    <td><span class="car">{{ bukaB === x.m + side[0] + r.s ? '▾' : '▸' }}</span> <b>{{ r.s }}</b>
                      <span v-if="isHsc(r.s)" class="tag t-warn" title="Saham HSC: dikeluarkan dari perhitungan IHSG">HSC</span>
                      <div v-if="namaSaham(r.s)" class="small muted nm">{{ namaSaham(r.s) }}</div></td>
                    <td class="num">{{ lot(r.lot) }}</td>
                    <td class="num" :class="side[2]">{{ rp(r.val) }}</td>
                    <td class="num">{{ avg(r[side[3]]) }}</td>
                    <td class="small"><RepoTag :r="r.repo" /></td>
                  </tr>
                  <tr v-if="bukaB === x.m + side[0] + r.s" class="det"><td colspan="5"><SahamRingkas :kode="r.s" /></td></tr>
                  </template>
                </tbody>
              </table>
            </section>
          </div>
        </details>
      </template>
      <p class="muted small">Data per {{ data.updated }}. Net = beli − jual pada pasar reguler; harga rata-rata = nilai ÷ (lot × 100). Potensi repo: keterbukaan pemegang saham bertujuan repo/gadai/jaminan di bulan itu, atau crossing di pasar negosiasi oleh broker yang sama (lot selisih ≤10%, nilai ≥ Rp1 M); bukan kepastian. Bukan rekomendasi beli/jual.</p>
    </template>
  </div>
</template>

<style scoped>
.ctl{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;margin:6px 0}
.bln{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}
.two{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.gr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin:8px 0 14px;align-items:start}
.dv{display:grid;grid-template-columns:1fr 1fr;gap:0;border-right:1px dashed var(--rule)}
.dv .col{display:flex;flex-direction:column;gap:3px}.dv h4{margin:0 0 2px;font-size:12px;text-transform:uppercase}
.dv .col:first-child h4{text-align:right;padding-right:6px}.dv .col:last-child h4{padding-left:6px}
.bb{display:flex;align-items:center;gap:4px;background:none;border:1px solid transparent;padding:1px 4px;font:inherit;color:inherit;cursor:pointer;height:22px}
.bb.l{flex-direction:row;justify-content:flex-end}.bb:hover,.bb.on{background:var(--sheet);border-color:var(--rule)}
.bb i{display:block;height:12px;border-radius:2px;transition:width .5s ease}.bb.r i{background:var(--good)}.bb.l i{background:var(--strong)}
.bb b{font-size:12px;min-width:38px}.bb.l b{text-align:left}.bb .v{color:var(--muted);white-space:nowrap}
.mc h4{margin:0 0 4px;font-size:13px}
.msvg{width:100%;height:auto;display:block}.msvg .ax{stroke:var(--rule)}.msvg .up{fill:var(--good)}.msvg .dn{fill:var(--strong)}
.msvg .lb{font-size:10px;fill:var(--muted)}.msvg .avl{fill:none;stroke:#0d9488;stroke-width:1.6}.msvg .avd{fill:#0d9488}
.leg .k{display:inline-block;width:12px;height:8px;margin:0 3px 0 8px;vertical-align:middle}.leg .k.up{background:var(--good)}.leg .k.dn{background:var(--strong)}.leg .k.av{height:2px;background:#0d9488}
@media (max-width:1100px){.gr{grid-template-columns:1fr}}
.lr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
.lr section{min-width:0}
.cmp{font-size:13px;width:100%}.cmp td,.cmp th{padding:5px 6px}
.bk sup{color:var(--muted);margin-left:1px;font-size:10px}
.repo{margin-left:4px;font-size:10px;padding:0 4px}
@media (max-width:1100px){.lr{grid-template-columns:1fr}}
.two section{min-width:0}.scroll{overflow-x:auto}
.mo .two{grid-template-columns:repeat(2,minmax(0,1fr))}
.bk{display:inline-block;margin-right:8px;white-space:nowrap}
.mo{border-top:1px solid var(--rule);padding:6px 0}
.mo summary{cursor:pointer}
h4{margin:6px 0}
.field{margin-left:6px;max-width:360px}
@media (max-width:1100px){.mo .two{grid-template-columns:1fr}}
.row{cursor:pointer}.row:hover,.row.open{background:var(--accent-soft)}.car{color:var(--muted)}.det td{background:var(--sheet)}
.nm{max-width:26ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}
</style>
