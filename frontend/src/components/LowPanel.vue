<script setup>
// Low: saham yang sudah di titik terendah. Dua kategori dari /api/recovery:
// "Sudah di dasar" (turun >= 50% dari puncak 52 minggu dan <= 10% di atas terendah setahun) dan
// "Low per periode" (semua saham terpantau, disaring menurut penurunan 1D..10Y, terdalam lebih dulu).
import { computed, reactive, ref, watch } from 'vue'
import { api } from '../api.js'
import { fmt } from '../lib/domain.js'
import { HSC_OPSI, isHsc, lolosHsc, hscInfo } from '../lib/hsc.js'
import SahamRingkas from './SahamRingkas.vue'
import { namaSaham } from '../lib/namaSaham.js'

const bulan = ref(new Date().getMonth() + 1)
const data = ref(null), err = ref(''), loading = ref(true)
async function load() {
  loading.value = true; err.value = ''
  try {
    const r = await api.get('/api/recovery', { bulan: bulan.value })
    if (r.error) { err.value = r.error; data.value = null } else data.value = r
  } catch (e) { err.value = e.message || String(e) } finally { loading.value = false }
}
load()

const f = reactive({ hsc: '' })
const KAT = [['dasar', 'Sudah di dasar'], ['low', 'Low per periode']]
const kat = ref('dasar')
const PER = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y']
// Potensi rebound (pantulan dari titik terendah) & recovery (momentum pulih) dari server; saringan dan urutan opsional.
const g = reactive({ rebound: '', pulih: false, urut: '' })
const URUT = [['', 'Low terdalam'], ['rebound', 'Potensi rebound'], ['pulih', 'Recovery']]
const lolosPotensi = x => (!g.rebound || (g.rebound === 'Tinggi' ? x.potensi?.rebound.label === 'Tinggi' : x.potensi?.rebound.label !== 'Rendah')) &&
  (!g.pulih || x.potensi?.pulih.label === 'Mulai pulih')
const urutkan = (r, dasarFn) => g.urut === 'rebound' ? [...r].sort((a, b) => b.potensi.rebound.skor - a.potensi.rebound.skor || dasarFn(a, b))
  : g.urut === 'pulih' ? [...r].sort((a, b) => b.potensi.pulih.skor - a.potensi.pulih.skor || (a.potensi.pulih.estimasiHari ?? 999) - (b.potensi.pulih.estimasiHari ?? 999))
  : [...r].sort(dasarFn)
const dasar = computed(() => urutkan((data.value?.dasar || []).filter(x => lolosHsc(x.t, f.hsc) && lolosPotensi(x)), (a, b) => b.tek.turun - a.tek.turun))
const hari = n => n == null ? '' : n <= 5 ? `±${n} hari` : n <= 22 ? `±${Math.round(n / 5)} minggu` : `±${Math.round(n / 21)} bulan`
const nadaR = l => l === 'Tinggi' ? 'c-good' : l === 'Sedang' ? 'c-warn' : 'muted'
const nadaP = l => l === 'Mulai pulih' ? 'c-good' : l === 'Awal' ? 'c-warn' : 'muted'
const fp = ref('1M'), batas = ref(0), lowN = ref(100)
const BATAS = [0, 10, 25, 50, 75]
const low = computed(() => {
  const p = fp.value
  return urutkan((data.value?.low || []).filter(x => lolosHsc(x.t, f.hsc) && lolosPotensi(x) && x.ret?.[p] != null && x.ret[p] < 0 && x.ret[p] <= -batas.value),
    (a, b) => a.ret[p] - b.ret[p])
})
watch([fp, batas, () => g.rebound, () => g.pulih, () => g.urut], () => { lowN.value = 100 })
const hitung = computed(() => ({ dasar: dasar.value.length, low: low.value.length }))
const buka = ref('')
const rp = v => v == null ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 1) + '%'
</script>

<template>
  <section class="lw">
    <p class="small muted intro">Saham yang sudah berada di titik terendah: <b>Sudah di dasar</b> (dekat terendah setahun) dan
      <b>Low per periode</b> (penurunan terdalam pada periode 1D–10Y). Diperbarui otomatis Senin–Sabtu pukul 00.01 WIB.</p>
    <div class="kat" role="tablist" aria-label="Kategori Low">
      <button v-for="[k, l] in KAT" :key="k" type="button" role="tab" class="pill" :aria-selected="String(kat === k)" :aria-pressed="String(kat === k)" @click="kat = k; buka = ''">
        {{ l }} <span v-if="data" class="muted">{{ hitung[k] }}</span></button>
    </div>
    <div class="flt" role="group" aria-label="Saringan potensi">
      <span class="small muted">Potensi rebound:</span>
      <button v-for="[v, l] in [['', 'Semua'], ['Sedang', 'Sedang ke atas'], ['Tinggi', 'Tinggi']]" :key="v" type="button" class="pill sm" :aria-pressed="String(g.rebound === v)" @click="g.rebound = v">{{ l }}</button>
      <button type="button" class="pill sm" :aria-pressed="String(g.pulih)" @click="g.pulih = !g.pulih">Recovery: mulai pulih</button>
      <span class="small muted sep">Urutkan:</span>
      <button v-for="[v, l] in URUT" :key="v" type="button" class="pill sm" :aria-pressed="String(g.urut === v)" @click="g.urut = v">{{ l }}</button>
    </div>
    <div class="flt" role="group" aria-label="Saham HSC" :title="hscInfo()">
      <span class="small muted">HSC:</span>
      <button v-for="[v, l] in HSC_OPSI" :key="v" type="button" class="pill sm" :aria-pressed="String(f.hsc === v)" @click="f.hsc = v">{{ l }}</button>
    </div>
    <p v-if="loading" class="muted">Memuat data Low…</p>
    <p v-else-if="err" class="muted">{{ err }}</p>
    <template v-else-if="data && kat === 'low'">
      <div class="flt" role="group" aria-label="Periode low">
        <span class="small muted">Low periode:</span>
        <button v-for="p in PER" :key="p" type="button" class="pill sm" :aria-pressed="String(fp === p)" @click="fp = p">{{ p }}</button>
      </div>
      <div class="flt" role="group" aria-label="Penurunan minimal">
        <span class="small muted">Turun minimal:</span>
        <button v-for="b in BATAS" :key="b" type="button" class="pill sm" :aria-pressed="String(batas === b)" @click="batas = b">{{ b ? b + '%' : 'Semua' }}</button>
      </div>
      <!-- Low per periode: saham yang turun pada periode terpilih, terdalam lebih dulu (format tab lain tidak berubah). -->
      <div class="mh"><h2>Low per periode</h2><span class="small muted">{{ low.length }} saham turun pada periode {{ fp }}{{ batas ? ` ≥ ${batas}%` : '' }}, terdalam lebih dulu ({{ data.low?.length || 0 }} dipindai) · data {{ data.updated }}</span></div>
      <p v-if="!data.low" class="muted small">Data kinerja per periode sedang disiapkan server; muat ulang beberapa menit lagi.</p>
      <div class="scroll">
        <table class="ledger">
          <thead><tr>
            <th>Saham</th><th class="num">Harga</th><th class="num">Dari puncak 52 mgg</th><th class="num">Di atas terendah</th><th>Potensi rebound</th><th>Recovery</th>
            <th v-for="p in PER" :key="p" class="num sortable" :class="{ aktif: fp === p }" @click="fp = p">{{ p }}{{ fp === p ? ' ▴' : '' }}</th>
          </tr></thead>
          <tbody>
            <template v-for="x in low.slice(0, lowN)" :key="x.t">
              <tr class="row" :class="{ open: buka === x.t }" tabindex="0" @click="buka = buka === x.t ? '' : x.t" @keydown.enter="buka = buka === x.t ? '' : x.t">
                <td><span class="car">{{ buka === x.t ? '▾' : '▸' }}</span> <b>{{ x.t }}</b>
                  <span v-if="isHsc(x.t)" class="tag t-warn" title="Saham HSC: dikeluarkan dari perhitungan IHSG">HSC</span>
                  <div v-if="x.nama || namaSaham(x.t)" class="small muted nm">{{ x.nama || namaSaham(x.t) }}</div></td>
                <td class="num">{{ rp(x.harga) }}</td>
                <td class="num">{{ x.turun != null ? '−' + fmt(x.turun, 0) + '%' : '–' }}</td>
                <td class="num">{{ pct(x.dariRendah) }}</td>
                <td class="small pot" :title="x.potensi?.rebound.alasan.join(' · ')"><b :class="nadaR(x.potensi?.rebound.label)">{{ x.potensi?.rebound.label || '–' }}</b>
                  <span v-if="x.potensi?.rebound.naik != null" class="muted"> · TP1 {{ rp(x.potensi.rebound.tp1) }} ({{ pct(x.potensi.rebound.naik) }})</span></td>
                <td class="small pot" :title="x.potensi?.pulih.sinyal.join(' · ')"><b :class="nadaP(x.potensi?.pulih.label)">{{ x.potensi?.pulih.label || '–' }}</b>
                  <span v-if="x.potensi?.pulih.estimasiHari" class="muted"> · TP1 {{ hari(x.potensi.pulih.estimasiHari) }}</span></td>
                <td v-for="p in PER" :key="p" class="num" :class="{ aktif: fp === p }"><span v-if="x.ret?.[p] != null" class="ret" :class="x.ret[p] >= 0 ? 'up' : 'dn'">{{ pct(x.ret[p]) }}</span><span v-else class="muted">–</span></td>
              </tr>
              <tr v-if="buka === x.t" class="det"><td :colspan="6 + PER.length"><SahamRingkas :kode="x.t" :bulan="bulan" /></td></tr>
            </template>
          </tbody>
        </table>
      </div>
      <p v-if="low.length > lowN" class="small"><button type="button" class="pill sm" @click="lowN += 100">Tampilkan 100 lagi ({{ low.length - lowN }} tersisa)</button></p>
      <p class="small muted">Kinerja 1D–1Y dari harga penutupan harian; 3Y/5Y/10Y hanya tersedia untuk saham kategori Sudah di dasar (riwayat Stockbit maks. 5 tahun).
        Penurunan dalam belum tentu berbalik — cek kategori <b>Recovery tercepat</b> untuk konfirmasi pemulihan.</p>
      <p class="small muted"><b>Potensi rebound</b> (0–100): RSI jenuh jual &lt;30 = 30 / &lt;40 = 20, menempel terendah (≤5%) 20 / dekat (≤15%) 10,
        memantul sepekan 20, higher low 15, volume ≥ 1,5× 15 — Tinggi ≥ 60, Sedang ≥ 35. <b>Recovery</b>: sinyal pulih (EMA20, higher low,
        naik 20 hari, volume, RSI 40–65) — Mulai pulih ≥ 50, Awal ≥ 25, beserta perkiraan waktu ke TP1 bila laju 10 hari positif.
        Arahkan kursor ke kolom untuk melihat alasannya.</p>
    </template>

    <template v-else-if="data && kat === 'dasar'">
      <!-- Sudah di dasar: turun dalam dari puncak 52 minggu dan harga masih menempel titik terendah setahun. -->
      <div class="mh"><h2>Sudah di dasar</h2><span class="small muted">{{ dasar.length }} saham turun ≥ {{ data.dasarTurun ?? 50 }}% dari puncak 52 minggu dan ≤ {{ data.dasarJarak ?? 10 }}% di atas titik terendah setahun · data {{ data.updated }}</span></div>
      <p v-if="data.skemaLama" class="muted small">Kinerja per periode sedang dihitung ulang server; muat ulang beberapa menit lagi.</p>
      <div class="scroll">
        <table class="ledger">
          <thead><tr>
            <th>Saham</th><th class="num">Harga</th><th class="num">Turun</th><th class="num">Di atas terendah</th><th>Potensi rebound</th><th>Recovery</th>
            <th v-for="p in PER" :key="p" class="num">{{ p }}</th>
          </tr></thead>
          <tbody>
            <template v-for="x in dasar" :key="x.t">
              <tr class="row" :class="{ open: buka === x.t }" tabindex="0" @click="buka = buka === x.t ? '' : x.t" @keydown.enter="buka = buka === x.t ? '' : x.t">
                <td><span class="car">{{ buka === x.t ? '▾' : '▸' }}</span> <b>{{ x.t }}</b>
                  <span v-if="isHsc(x.t)" class="tag t-warn" title="Saham HSC: dikeluarkan dari perhitungan IHSG">HSC</span>
                  <div v-if="x.nama || namaSaham(x.t)" class="small muted nm">{{ x.nama || namaSaham(x.t) }}</div></td>
                <td class="num">{{ rp(x.tek.harga) }}</td>
                <td class="num c-strong">−{{ fmt(x.tek.turun, 0) }}%</td>
                <td class="num">{{ pct(x.tek.dariRendah) }}</td>
                <td class="small pot" :title="x.potensi?.rebound.alasan.join(' · ')"><b :class="nadaR(x.potensi?.rebound.label)">{{ x.potensi?.rebound.label || '–' }}</b>
                  <span v-if="x.potensi?.rebound.naik != null" class="muted"> · TP1 {{ rp(x.potensi.rebound.tp1) }} ({{ pct(x.potensi.rebound.naik) }})</span></td>
                <td class="small pot" :title="x.potensi?.pulih.sinyal.join(' · ')"><b :class="nadaP(x.potensi?.pulih.label)">{{ x.potensi?.pulih.label || '–' }}</b>
                  <span v-if="x.potensi?.pulih.estimasiHari" class="muted"> · TP1 {{ hari(x.potensi.pulih.estimasiHari) }}</span></td>
                <td v-for="p in PER" :key="p" class="num"><span v-if="x.ret?.[p] != null" class="ret" :class="x.ret[p] >= 0 ? 'up' : 'dn'">{{ pct(x.ret[p]) }}</span><span v-else class="muted">–</span></td>
              </tr>
              <tr v-if="buka === x.t" class="det"><td :colspan="6 + PER.length"><SahamRingkas :kode="x.t" :bulan="bulan" /></td></tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="small muted">Kinerja 1D–1Y dihitung dari harga penutupan harian; 3Y/5Y/10Y dari riwayat harga Stockbit bila tersedia (kosong bila
        riwayat tidak mencakup periode itu). Harga di dasar belum tentu berbalik — konfirmasi pemulihan ada di kategori <b>Recovery tercepat</b>.</p>
    </template>

  </section>
</template>

<style scoped>
.intro{max-width:120ch;margin:6px 0 10px}
.kat{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
.flt{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:8px}
.mh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mh h2{margin:6px 0}
.scroll{overflow-x:auto}
.row{cursor:pointer}.row:hover,.row.open{background:var(--accent-soft)}
.car{color:var(--muted)}.tag{margin-left:6px}
.det td{background:var(--sheet)}
.nm{max-width:26ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}
.ret{display:inline-block;min-width:58px;padding:1px 6px;border-radius:4px;font-variant-numeric:tabular-nums}
.ret.up{color:var(--good,#1a8a4a);background:color-mix(in srgb,var(--good,#1a8a4a) 12%,transparent)}
.ret.dn{color:var(--warn,#c77a1a);background:color-mix(in srgb,var(--warn,#c77a1a) 12%,transparent)}
.sortable{cursor:pointer;user-select:none}.sortable:hover,.aktif{background:var(--accent-soft)}
.pot{white-space:nowrap}.sep{margin-left:10px}.c-warn{color:var(--warn,#c79a1a)}
</style>
