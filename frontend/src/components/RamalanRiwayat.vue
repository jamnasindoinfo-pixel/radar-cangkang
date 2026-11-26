<script setup>
// Riwayat ramalan vs kenyataan (/api/ramalan): ramalan Time Series (esok/1 minggu/1 bulan) atau bias Astronacci yang
// sudah jatuh tempo dibandingkan dengan penutupan IHSG sebenarnya, beserta ketepatan arah. Dicatat server tiap hari bursa.
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { fmt } from '../lib/domain.js'

const props = defineProps({ jenis: { type: String, default: 'ts' } })   // 'ts' | 'astro'
const d = ref(null), err = ref('')
api.get('/api/ramalan').then(r => { if (r.error) err.value = r.error; else d.value = r }, e => { err.value = e.message || String(e) })

const H = [['1', 'Esok'], ['5', '1 minggu'], ['21', '1 bulan']]
const n0 = v => v == null ? '–' : Math.round(v).toLocaleString('id-ID')
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 2) + '%'
const tepat = v => v == null ? '–' : v ? '✓ tepat' : '✗ meleset'
const cls = v => v == null ? 'muted' : v ? 'c-good' : 'c-strong'
const baris = computed(() => props.jenis === 'astro' ? d.value?.astro?.baris || [] : (d.value?.ts?.baris || []).filter(r => r.aktual != null))
const menunggu = computed(() => props.jenis === 'astro' ? (d.value?.astro?.baris || []).filter(r => r.aktual == null).length
  : (d.value?.ts?.baris || []).filter(r => r.aktual == null).length)
</script>

<template>
  <section class="rr">
    <div class="mh"><h2>Riwayat ramalan vs kenyataan</h2>
      <span v-if="d" class="small muted">dicatat sejak {{ d.mulai || '–' }} · {{ d.tercatat }} hari bursa</span></div>
    <p v-if="err" class="small muted">{{ err }}</p>
    <template v-else-if="d">
      <div v-if="jenis === 'ts'" class="kpi">
        <div v-for="[h, l] in H" :key="h"><span class="small muted">{{ l }}</span>
          <b>{{ d.ts.ringkas[h].arahTepat != null ? d.ts.ringkas[h].arahTepat + '% arah tepat' : 'belum ada' }}</b>
          <span class="small muted">{{ d.ts.ringkas[h].n }} ramalan · rata-rata meleset {{ d.ts.ringkas[h].galat != null ? fmt(d.ts.ringkas[h].galat, 2) + '%' : '–' }}</span></div>
      </div>
      <div v-else class="kpi">
        <div><span class="small muted">Bias 1 bulan (21 hari bursa)</span>
          <b>{{ d.astro.ringkas.arahTepat != null ? d.astro.ringkas.arahTepat + '% arah tepat' : 'belum ada' }}</b>
          <span class="small muted">{{ d.astro.ringkas.n }} ramalan jatuh tempo</span></div>
      </div>
      <p v-if="!baris.length" class="small muted">Belum ada ramalan yang jatuh tempo. Ramalan dicatat setiap hari bursa;
        ramalan esok mulai bisa dinilai besok, 1 minggu setelah 5 hari bursa, 1 bulan setelah 21 hari bursa{{ menunggu ? ` (${menunggu} ramalan menunggu)` : '' }}.</p>
      <div v-else class="scroll">
        <table v-if="jenis === 'ts'" class="ledger">
          <thead><tr><th>Dibuat</th><th>Horizon</th><th class="num">IHSG saat itu</th><th class="num">Ramalan</th><th class="num">Aktual</th><th class="num">Meleset</th><th>Arah</th></tr></thead>
          <tbody><tr v-for="r in baris.slice(0, 30)" :key="r.tanggal + r.h">
            <td>{{ r.tanggal }}</td><td>{{ H.find(x => x[0] === String(r.h))[1] }} <span class="muted small">({{ r.tglAktual }})</span></td>
            <td class="num">{{ n0(r.harga) }}</td><td class="num">{{ n0(r.ramalan) }}</td><td class="num"><b>{{ n0(r.aktual) }}</b></td>
            <td class="num">{{ pct(r.selisih) }}</td><td :class="cls(r.arahTepat)">{{ tepat(r.arahTepat) }}</td>
          </tr></tbody>
        </table>
        <table v-else class="ledger">
          <thead><tr><th>Dibuat</th><th class="num">IHSG saat itu</th><th>Bias</th><th>Rekomendasi</th><th class="num">IHSG +21 hari</th><th class="num">Perubahan</th><th>Arah</th></tr></thead>
          <tbody><tr v-for="r in baris.slice(0, 30)" :key="r.tanggal">
            <td>{{ r.tanggal }}</td><td class="num">{{ n0(r.harga) }}</td><td>{{ r.bias }}</td><td class="small">{{ r.tindakan || '–' }}</td>
            <td class="num">{{ n0(r.aktual) }}</td><td class="num">{{ pct(r.ubah) }}</td><td :class="cls(r.arahTepat)">{{ r.aktual == null ? 'menunggu' : tepat(r.arahTepat) }}</td>
          </tr></tbody>
        </table>
      </div>
      <p class="small muted">Arah tepat = ramalan dan kenyataan sama-sama naik atau sama-sama turun dari harga saat ramalan dibuat. 50% setara menebak.</p>
    </template>
  </section>
</template>

<style scoped>
.rr{margin-top:18px}
.mh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mh h2{margin:6px 0}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:6px 0 10px}
.kpi>div{border:1px solid var(--rule);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}
.scroll{overflow-x:auto}
</style>
