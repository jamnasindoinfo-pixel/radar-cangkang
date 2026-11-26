<script setup>
// Struktur rencana korporasi dari dokumen keterbukaan (ri-dokumen.json → rencanaKorporasi):
// langkah berurutan beserta pihak, nilai, waktu, status, dan keterangan.
defineProps({ rk: { type: Object, required: true } })
const ST = { selesai: ['Selesai', 't-good'], berjalan: ['Berjalan', 't-now'], rencana: ['Rencana', 't-warn'] }
</script>

<template>
  <div class="rk">
    <h3 class="lbl">Struktur rencana korporasi</h3>
    <p v-if="rk.ringkas" class="small lead">{{ rk.ringkas }}</p>
    <ol class="steps">
      <li v-for="(x, i) in rk.langkah || []" :key="i" :class="'s-' + (x.status || 'rencana')">
        <span class="no" aria-hidden="true">{{ i + 1 }}</span>
        <div class="bd">
          <div class="hd">
            <b>{{ x.judul }}</b>
            <span class="tag" :class="(ST[x.status] || ST.rencana)[1]">{{ (ST[x.status] || ST.rencana)[0] }}</span>
            <span v-if="x.waktu && x.waktu !== '–'" class="small muted">{{ x.waktu }}</span>
          </div>
          <p v-if="x.pihak" class="small"><span class="muted">Pihak:</span> {{ x.pihak }}</p>
          <p v-if="x.nilai && x.nilai !== '–'" class="small"><span class="muted">Nilai:</span> <b>{{ x.nilai }}</b></p>
          <p v-if="x.ket" class="small ket"><span class="muted">Keterangan:</span> {{ x.ket }}</p>
        </div>
      </li>
    </ol>
    <p v-if="rk.catatan" class="small muted">{{ rk.catatan }}</p>
  </div>
</template>

<style scoped>
.rk{margin:12px 0}
.lead{max-width:95ch;font-weight:600}
.steps{list-style:none;margin:8px 0;padding:0;display:flex;flex-direction:column;gap:0}
.steps li{display:grid;grid-template-columns:30px 1fr;column-gap:10px;position:relative;padding-bottom:10px}
.steps li::before{content:'';position:absolute;left:14px;top:28px;bottom:0;width:2px;background:var(--rule)}
.steps li:last-child::before{display:none}
.no{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 13px var(--f-display);background:var(--sheet-2);border:2px solid var(--rule);z-index:1}
.s-selesai .no{border-color:var(--good)}
.s-berjalan .no{border-color:var(--now-ink, var(--accent))}
.s-rencana .no{border-color:var(--warn)}
.bd{border:1px solid var(--rule);background:var(--sheet);padding:8px 10px}
.hd{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:2px}
.bd p{margin:2px 0;line-height:1.5}
.ket{max-width:100ch}
</style>
