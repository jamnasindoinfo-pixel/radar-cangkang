<script setup>
// "Terbukti bulan lalu?" (/api/season-bukti): pola Seasonality bulan lalu dihitung dari 10 tahun SEBELUM tahun berjalan
// (tanpa melihat hasil), lalu dibandingkan dengan kinerja saham pada bulan itu tahun ini.
import { ref } from 'vue'
import { api } from '../api.js'
import { fmt } from '../lib/domain.js'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const d = ref(null), err = ref('')
api.get('/api/season-bukti').then(r => { if (r.error) err.value = r.error; else d.value = r }, e => { err.value = e.message || String(e) })
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 1) + '%'
const nada = v => v == null ? 'muted' : v > 0 ? 'c-good' : v < 0 ? 'c-strong' : 'muted'
const buka = ref(false)
</script>

<template>
  <section class="rule-top sb">
    <div class="mh"><h2>Terbukti bulan lalu?</h2>
      <span v-if="d" class="small muted">pola {{ BLN[d.bulan - 1] }} dari 10 tahun sebelum {{ d.tahun }}, dibandingkan hasil {{ BLN[d.bulan - 1] }} {{ d.tahun }}</span></div>
    <p v-if="err" class="small muted">{{ err }}</p>
    <template v-else-if="d">
      <div class="kpi">
        <div><span class="small muted">25 saham pola terkuat</span><b>{{ d.ringkas.pilihanNaik }} dari {{ d.ringkas.pilihanN }} naik</b>
          <span class="small" :class="nada(d.ringkas.pilihanMedian)">median {{ pct(d.ringkas.pilihanMedian) }}</span></div>
        <div><span class="small muted">Semua saham berpola naik ≥ 70%</span><b>{{ d.ringkas.polaKuatNaik ?? '–' }}% naik</b>
          <span class="small muted">{{ d.ringkas.polaKuatN }} saham</span></div>
        <div><span class="small muted">Pembanding: semua saham</span><b>{{ d.ringkas.semuaNaik ?? '–' }}% naik</b>
          <span class="small muted">{{ d.ringkas.semuaN }} saham</span></div>
        <div><span class="small muted">IHSG (peluang naik {{ d.ihsg.prob ?? '–' }}%)</span><b :class="nada(d.ihsg.aktual)">{{ pct(d.ihsg.aktual) }}</b>
          <span class="small" :class="d.ihsg.terbukti ? 'c-good' : d.ihsg.terbukti === false ? 'c-strong' : 'muted'">{{ d.ihsg.terbukti == null ? '–' : d.ihsg.terbukti ? 'sesuai pola' : 'tidak sesuai pola' }}</span></div>
      </div>
      <p class="small muted">Pola dianggap berguna bila persentase naik saham berpola kuat lebih tinggi daripada pembanding semua saham.</p>
      <button type="button" class="pill sm" :aria-expanded="String(buka)" @click="buka = !buka">{{ buka ? 'Sembunyikan' : 'Lihat' }} 25 saham pola terkuat</button>
      <div v-if="buka" class="scroll">
        <table class="ledger">
          <thead><tr><th>Saham</th><th class="num">Peluang naik</th><th class="num">Median historis</th><th class="num">Hasil {{ BLN[d.bulan - 1] }} {{ d.tahun }}</th><th>Terbukti</th></tr></thead>
          <tbody><tr v-for="x in d.pilihan" :key="x.t">
            <td><RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }"><b>{{ x.t }}</b></RouterLink>
              <div v-if="x.nama" class="small muted">{{ x.nama }}</div></td>
            <td class="num">{{ x.prob }}% ({{ x.up }}/{{ x.n }})</td><td class="num" :class="nada(x.median)">{{ pct(x.median) }}</td>
            <td class="num" :class="nada(x.aktual)"><b>{{ pct(x.aktual) }}</b></td>
            <td :class="x.terbukti ? 'c-good' : 'c-strong'">{{ x.terbukti ? '✓ naik' : '✗ turun' }}</td>
          </tr></tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.mh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mh h2{margin:6px 0}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:6px 0 8px}
.kpi>div{border:1px solid var(--rule);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}
.scroll{overflow-x:auto;margin-top:8px}
</style>
