<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { chText, meaningful } from '../../lib/diff.js'
import { store, loadDiff, itemOf } from '../../store.js'
import { tlEvents, fmtDate } from '../../lib/domain.js'
import { isBackdoorNews, backdoorTickers, MARKET_WRAP } from '../../lib/news.js'

// Empat panel kerja: yang berubah sejak kemarin/7 hari (snapshot harian server), keterbukaan backdoor
// 3 hari terakhir, tanggal jatuh tempo 14 hari ke depan, dan update terbaru saham di Monitor (dengan pencarian).
// note = ringkasan laporan baru sejak ditandai dilihat (dari MonitorView); seen = tombol tandai.
defineProps({ note: String, canMark: Boolean })
const emit = defineEmits(['seen'])
// Tanggal lokal YYYY-MM-DD, n hari dari sekarang.
const day = n => { const t = new Date(Date.now() + n * 864e5); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
const today = day(0)
const fresh = computed(() => {
  const set = backdoorTickers(store.items)
  return store.updates.filter(u => u.date && u.date.slice(0, 10) >= day(-3) && isBackdoorNews(u, store.items, set))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
})
// Diff harian dari /api/diff (dimuat di store, dipakai juga kartu Hari ini).
const span = ref(1)
watch(span, d => loadDiff(d), { immediate: true })
const diff = computed(() => store.diff[span.value])
const diffErr = computed(() => diff.value?.error || '')
const changed = computed(() => (diff.value?.items || [])
  .map(x => ({ t: x.ticker, ch: meaningful(x.changes) }))
  .filter(x => x.ch.length)
  .sort((a, b) => b.ch.length - a.ch.length || a.t.localeCompare(b.t)))
const baseTxt = computed(() => diff.value?.base ? fmtDate(diff.value.base) : '')

// Update terbaru saham di Monitor: tanpa pencarian = update terakhir tiap saham (terbaru dulu);
// dengan pencarian (kode/nama) = beberapa update terakhir saham yang cocok, beserta ringkasannya.
const q = ref('')
const kodeMonitor = computed(() => new Set(store.items.map(d => d.ticker)))
const cocok = computed(() => {
  const k = q.value.trim().toUpperCase()
  if (!k) return null
  return new Set(store.items.filter(d => d.ticker.startsWith(k) || (d.name || '').toUpperCase().includes(k)).map(d => d.ticker))
})
const terbaru = computed(() => {
  // Rangkuman pasar (IHSG, saham pilihan) hanya menyebut kode sambil lalu: bukan update emiten itu.
  const ups = store.updates.filter(u => u.ticker && u.date && kodeMonitor.value.has(u.ticker) && !MARKET_WRAP.test(u.title || ''))
    .sort((a, b) => b.date.localeCompare(a.date))
  if (cocok.value) return ups.filter(u => cocok.value.has(u.ticker)).slice(0, 8)
  const seen = new Set()
  return ups.filter(u => !seen.has(u.ticker) && seen.add(u.ticker)).slice(0, 8)
})
const ringkas = u => String(u.summary || '').replace(/\s*\(Ringkasan AI Stockbit\)\s*$/, '').slice(0, 220)

const due = computed(() => store.items.flatMap(d => tlEvents(d).filter(e => e.date >= today && e.date <= day(14)).map(e => ({ ...e, t: d.ticker })))
  .sort((a, b) => a.date.localeCompare(b.date)))

// Tiap panel tampil ciut (judul + jumlah isi) saat halaman dibuka; isinya muncul setelah judul diklik.
const ciut = reactive({ berubah: true, masuk: true, tempo: true, update: true })
const togel = k => { ciut[k] = !ciut[k] }
</script>

<template>
  <div class="agenda">
    <section class="chg">
      <div class="hd">
        <h2><button type="button" class="tg" :aria-expanded="String(!ciut.berubah)" @click="togel('berubah')">
          <span class="ar" aria-hidden="true">{{ ciut.berubah ? '▸' : '▾' }}</span>Berubah<span v-if="ciut.berubah" class="n">{{ changed.length }}</span></button></h2>
        <div v-if="!ciut.berubah" role="group" aria-label="Rentang perubahan" class="rng">
          <button v-for="[d, l] in [[1, 'sejak kemarin'], [7, '7 hari']]" :key="d" type="button" class="pill sm" :aria-pressed="String(span === d)" @click="span = d">{{ l }}</button>
        </div>
      </div>
      <template v-if="!ciut.berubah">
      <p v-if="diffErr" class="muted small">Perubahan belum bisa dimuat: {{ diffErr }}</p>
      <ol v-else-if="changed.length" class="cl">
        <li v-for="x in changed" :key="x.t">
          <RouterLink class="tk" :to="'/emiten/' + x.t">{{ x.t }}</RouterLink>
          <span class="tx">{{ x.ch.map(c => chText(c, itemOf(x.t), { verified: store.verified })).join(' · ') }}</span>
        </li>
      </ol>
      <p v-else class="muted small">{{ diff ? (diff.base ? `Belum ada perubahan berarti sejak ${baseTxt}.` : 'Snapshot pertama baru diambil hari ini; perubahan tampil mulai besok.') : 'Memuat…' }}</p>
      </template>
    </section>
    <section>
      <h2><button type="button" class="tg" :aria-expanded="String(!ciut.masuk)" @click="togel('masuk')">
        <span class="ar" aria-hidden="true">{{ ciut.masuk ? '▸' : '▾' }}</span>Masuk 3 hari<span v-if="ciut.masuk" class="n">{{ fresh.length }}</span></button></h2>
      <template v-if="!ciut.masuk">
      <p v-if="note" class="note small">{{ note }}
        <button v-if="canMark" type="button" class="linkbtn small" @click="emit('seen')">Tandai sudah dilihat</button>
      </p>
      <ol v-if="fresh.length">
        <li v-for="u in fresh" :key="u.id || u.title">
          <span class="d" :class="{ hot: u.date.slice(0, 10) === today }">{{ fmtDate(u.date.slice(0, 10)) }}</span>
          <RouterLink v-if="u.ticker" class="tk" :to="'/emiten/' + u.ticker">{{ u.ticker }}</RouterLink><span v-else></span>
          <span class="tx">{{ u.title }}</span>
        </li>
      </ol>
      <p v-else class="muted small">Belum ada keterbukaan baru tentang emiten backdoor dalam 3 hari terakhir.</p>
      </template>
    </section>
    <section>
      <h2><button type="button" class="tg" :aria-expanded="String(!ciut.tempo)" @click="togel('tempo')">
        <span class="ar" aria-hidden="true">{{ ciut.tempo ? '▸' : '▾' }}</span>Jatuh tempo 14 hari<span v-if="ciut.tempo" class="n">{{ due.length }}</span></button></h2>
      <template v-if="!ciut.tempo">
      <ol v-if="due.length">
        <li v-for="(e, i) in due" :key="i">
          <span class="d" :class="{ hot: e.date <= day(3) }">{{ fmtDate(e.date) }}</span>
          <RouterLink class="tk" :to="'/emiten/' + e.t">{{ e.t }}</RouterLink>
          <span class="tx">{{ e.label }}</span>
        </li>
      </ol>
      <p v-else class="muted small">Tidak ada tanggal tender atau tahapan yang jatuh dalam 14 hari ke depan.</p>
      </template>
    </section>
    <section class="upd">
      <h2><button type="button" class="tg" :aria-expanded="String(!ciut.update)" @click="togel('update')">
        <span class="ar" aria-hidden="true">{{ ciut.update ? '▸' : '▾' }}</span>Update terbaru<span v-if="ciut.update" class="n">{{ terbaru.length }}</span></button></h2>
      <template v-if="!ciut.update">
      <input v-model="q" type="search" class="field cari" placeholder="Cari kode/nama saham di Monitor…" aria-label="Cari update saham" list="kode-monitor" />
      <datalist id="kode-monitor"><option v-for="d in store.items" :key="d.ticker" :value="d.ticker">{{ d.name }}</option></datalist>
      <ol v-if="terbaru.length" class="ul">
        <li v-for="u in terbaru" :key="u.id || u.url || u.title">
          <span class="d" :class="{ hot: u.date.slice(0, 10) === today }">{{ fmtDate(u.date.slice(0, 10)) }}</span>
          <RouterLink class="tk" :to="'/emiten/' + u.ticker">{{ u.ticker }}</RouterLink>
          <span class="tx2">
            <a v-if="u.url" :href="u.url" target="_blank" rel="noopener">{{ u.title }}</a><template v-else>{{ u.title }}</template>
            <small v-if="cocok && ringkas(u)" class="rk">{{ ringkas(u) }}</small>
            <small class="muted">{{ u.source || 'Stockbit' }}</small>
          </span>
        </li>
      </ol>
      <p v-else class="muted small">{{ q ? `Tidak ada update untuk "${q}" di saham Monitor.` : 'Belum ada update.' }}</p>
      </template>
    </section>
  </div>
</template>

<style scoped>
.agenda{display:grid;grid-template-columns:1.1fr 1fr 1fr 1.1fr;gap:18px}
.hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
.rng{display:flex;gap:4px}
.pill.sm{min-height:26px;font-size:12.5px;padding:2px 8px}
.cl{max-height:236px;overflow:auto}
.cl li{grid-template-columns:56px 1fr}
@media (max-width:1199px){.agenda{grid-template-columns:1fr 1fr}}
.cari{width:100%;margin:0 0 6px;min-height:30px;font-size:13px}
.ul{max-height:300px;overflow:auto}
.tx2{min-width:0;font-size:13px;display:flex;flex-direction:column;gap:2px}
.tx2 a{color:var(--ink);overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
.rk{color:var(--ink-2);line-height:1.35}
section{background:var(--sheet);border:1px solid var(--rule);border-top:2px solid var(--ink);padding:12px 14px;min-width:0}
h2{font-size:16px;text-transform:uppercase;margin-bottom:6px}
.tg{all:unset;cursor:pointer;display:inline-flex;align-items:baseline;gap:6px;font:inherit;text-transform:inherit;color:inherit}
.tg:hover{color:var(--accent)}.tg:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ar{font-size:12px;color:var(--ink-2);width:12px}
.n{font:600 12px var(--f-data);color:var(--ink-2);background:var(--rule-2);border-radius:9px;padding:1px 7px;text-transform:none}
.note{margin:0 0 6px;color:var(--ink-2)}
ol{list-style:none;margin:0;padding:0}
li{display:grid;grid-template-columns:86px 56px 1fr;gap:8px;align-items:baseline;padding:5px 0;border-top:1px solid var(--rule-2)}
li:first-child{border-top:0}
.d{font:600 14px var(--f-display);color:var(--ink-2)}
.d.hot{color:var(--now-ink)}
.tk{font:700 15px var(--f-display);color:var(--ink);text-decoration:none;letter-spacing:.02em}
.tk:hover{text-decoration:underline}
.tx{min-width:0;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;font-size:13px}
@media (max-width:760px){.agenda{grid-template-columns:1fr}}
@media (max-width:420px){li{grid-template-columns:72px 48px 1fr}}
</style>
