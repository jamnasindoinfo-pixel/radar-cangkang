<script setup>
// Kotak "Perlu dicek": hasil audit harian Monitor terhadap daftar tender offer Stockbit dan keterbukaan/berita emiten.
// Hanya menampilkan temuan; data tim tidak diubah otomatis.
import { computed, onMounted, ref } from 'vue'
import { api } from '../../api.js'
import { kelompokAudit } from '../../lib/auditMonitor.js'

const data = ref(null)
onMounted(() => api.get('/api/audit-monitor').then(v => { data.value = v }, () => { data.value = null }))
const grup = computed(() => kelompokAudit(data.value?.temuan))
const n = computed(() => (data.value?.temuan || []).length)
</script>

<template>
  <details v-if="n" class="sheet audit">
    <summary>
      <h2>Perlu dicek <span class="n">{{ n }}</span></h2>
      <span class="muted small">Audit otomatis {{ data.updated }} WIB: tonggak Monitor dicocokkan dengan daftar tender offer dan keterbukaan Stockbit.</span>
    </summary>
    <ul class="list">
      <li v-for="g in grup" :key="g.t" class="em">
        <RouterLink class="ticker" :to="'/emiten/' + g.t">{{ g.t }}</RouterLink>
        <div class="isi">
          <div v-for="(x, i) in g.temuan" :key="i" class="tm">
            <span class="tag" :class="'t-' + x.tingkat">{{ x.label }}</span>
            <span class="small">{{ x.teks }}</span>
            <ul v-if="x.bukti?.length" class="bukti small muted">
              <li v-for="(b, j) in x.bukti" :key="j">{{ b }}</li>
            </ul>
          </div>
        </div>
      </li>
    </ul>
    <p class="muted small foot">Data tim tidak diubah otomatis. Perbaiki tahap atau catatan di halaman emiten bila temuan benar; temuan hilang pada audit berikutnya (setiap hari pukul 00.01 WIB).</p>
  </details>
</template>

<style scoped>
.audit{padding:0 16px;border-left:3px solid var(--warn)}
.audit summary{cursor:pointer;padding:12px 0;list-style-position:inside}
.audit summary h2{display:inline;font-size:19px;margin-right:10px}
.audit[open] summary{border-bottom:1px solid var(--rule-2);margin-bottom:8px}
.n{display:inline-block;min-width:24px;padding:0 6px;border-radius:12px;background:var(--warn-bg);color:var(--warn);font:700 14px var(--f-display);text-align:center}
.list{list-style:none;margin:0;padding:0}
.em{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:8px 0;border-bottom:1px solid var(--rule-2)}
.em .ticker{font-size:15px}
.tm + .tm{margin-top:6px}
.tm .tag{margin-right:6px}
.bukti{margin:2px 0 0;padding-left:18px}
.foot{margin:10px 0 12px}
@media (max-width:640px){.em{grid-template-columns:1fr;gap:4px}}
</style>
