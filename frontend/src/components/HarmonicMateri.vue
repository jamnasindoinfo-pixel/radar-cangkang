<script setup>
// Tab Materi halaman Harmonic Pattern: presentasi bergaya makalah (Pendahuluan sampai Penutup dan Lampiran) dari
// Harmonic Trading Vol. 1 (Carney) untuk saham BEI. Daftar isi per bagian di kiri, slide di kanan (panah kiri/kanan),
// paragraf, tabel, diagram pola ideal, rujukan bab, daftar periksa dan rencana belajar yang bisa dicentang (tersimpan
// di browser), dan tombol "Coba di chart" yang membuka tab Saham dengan alat terkait aktif.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BAGIAN, SLIDE, diagramAbcd, totalSlide } from '../lib/harmonikMateri.js'
import { diagramIdeal } from '../lib/harmonikAlat.js'
import PolaDiagram from './PolaDiagram.vue'
import HarmonicPresentasi from './HarmonicPresentasi.vue'

const emit = defineEmits(['coba'])
const NAMA_ALAT = { xabcd: 'XABCD', fib: 'Fib retracement', ext: 'Trend-based fib extension', elliott: 'Elliott', long: 'Long position', short: 'Short position' }

// Simpanan per penampil (posisi slide, centang); aman bila localStorage tidak tersedia.
const baca = (k, awal) => { try { const v = localStorage.getItem('radar-cangkang.hm-' + k); return v == null ? awal : JSON.parse(v) } catch { return awal } }
const simpan = (k, v) => { try { localStorage.setItem('radar-cangkang.hm-' + k, JSON.stringify(v)) } catch {} }

const ke = ref(Math.min(totalSlide - 1, Math.max(0, Number(baca('slide', 0)) || 0)))
watch(ke, v => simpan('slide', v))
const slide = computed(() => SLIDE[ke.value] || null)
const maju = () => { if (ke.value < totalSlide - 1) ke.value++ }
const mundur = () => { if (ke.value > 0) ke.value-- }
function tombol(e) {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return
  if (e.key === 'ArrowRight') { e.preventDefault(); maju() }
  if (e.key === 'ArrowLeft') { e.preventDefault(); mundur() }
}
onMounted(() => window.addEventListener('keydown', tombol))
onBeforeUnmount(() => window.removeEventListener('keydown', tombol))

const diagram = computed(() => {
  const p = slide.value?.pola
  if (!p) return null
  return p === 'abcd' ? diagramAbcd('bullish') : diagramIdeal(p, 'bullish')
})

const centang = ref(baca('centang', {}))
watch(centang, v => simpan('centang', v), { deep: true })
const kunciC = (id, i) => `${id}:${i}`
const jumlahCentang = id => Object.keys(centang.value).filter(k => k.startsWith(id + ':') && centang.value[k]).length

// Daftar isi per bagian (nomor Romawi).
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
const isi = computed(() => BAGIAN.map((b, n) => ({ b, no: ROMAWI[n],
  slide: SLIDE.map((s, i) => ({ i, judul: s.judul, bagian: s.bagian })).filter(x => x.bagian === b) }))
  .filter(g => g.slide.length))
const bagianKini = computed(() => slide.value?.bagian || 'Lampiran')
const noBagian = b => ROMAWI[BAGIAN.indexOf(b)] || ''
const terbuka = ref({})
watch(bagianKini, b => { terbuka.value = { ...terbuka.value, [b]: true } }, { immediate: true })

// Mode presentasi layar penuh, mulai dari slide yang sedang dibuka.
const presentasi = ref(false)
function cobaDariPresentasi(alat) { presentasi.value = false; emit('coba', alat) }

// Unduh seluruh materi sebagai dokumen bergaya makalah (jsPDF dimuat saat tombol ditekan).
const busyPdf = ref(false)
async function unduh() {
  if (busyPdf.value) return
  busyPdf.value = true
  try {
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../lib/materiPdf.js')])
    P.materiPdf({ slide: SLIDE, bagian: BAGIAN }, jsPDF).save(P.materiPdfName())
  } finally { busyPdf.value = false }
}

</script>

<template>
  <section class="mt">
    <nav class="isi" aria-label="Daftar isi materi">
      <button type="button" class="btn mulai" @click="presentasi = true">▶ Mulai presentasi</button>
      <button type="button" class="btn unduhM" :disabled="busyPdf" @click="unduh">{{ busyPdf ? 'Menyiapkan PDF…' : 'Unduh materi (PDF)' }}</button>
      <p class="small mute">Daftar isi · {{ totalSlide }} slide</p>
      <details v-for="g in isi" :key="g.b" class="grup" :open="terbuka[g.b]" @toggle="e => terbuka = { ...terbuka, [g.b]: e.target.open }">
        <summary :class="{ kini: g.b === bagianKini }"><b>{{ g.no }}.</b> {{ g.b }} <span class="mute">({{ g.slide.length }})</span></summary>
        <ol>
          <li v-for="x in g.slide" :key="x.i"><button type="button" :class="{ on: ke === x.i }" @click="ke = x.i">{{ x.judul }}</button></li>
        </ol>
      </details>
    </nav>

    <div class="panggung">
      <div class="prog" role="progressbar" :aria-valuenow="ke + 1" aria-valuemin="1" :aria-valuemax="totalSlide"><i :style="{ width: (ke + 1) / totalSlide * 100 + '%' }"></i></div>
      <article class="slide" aria-live="polite">
        <template v-if="slide">
          <header>
            <span class="no">Bagian {{ noBagian(slide.bagian) }} · {{ slide.bagian }} · slide {{ ke + 1 }} / {{ totalSlide }}</span>
            <h2>{{ slide.judul }}</h2>
            <p v-if="slide.sub" class="sub">{{ slide.sub }}</p>
          </header>
          <div class="isiSlide" :class="{ dg: diagram }">
            <div>
              <p v-for="(t, i) in slide.paragraf || []" :key="'p' + i" class="prosa">{{ t }}</p>
              <ul v-if="slide.poin && !slide.periksa" class="poin">
                <li v-for="(p, i) in slide.poin" :key="i">{{ p }}</li>
              </ul>
              <ul v-if="slide.periksa" class="cek">
                <li v-for="(p, i) in slide.poin" :key="i"><label><input v-model="centang[kunciC(slide.id, i)]" type="checkbox" /> {{ p }}</label></li>
                <li class="small mute">{{ jumlahCentang(slide.id) }} dari {{ slide.poin.length }} tercentang. Masuk hanya bila semuanya tercentang.</li>
              </ul>
              <table v-if="slide.tabel" class="tb">
                <thead><tr><th v-if="slide.belajar">Selesai</th><th v-for="k in slide.tabel.kolom" :key="k">{{ k }}</th></tr></thead>
                <tbody>
                  <tr v-for="(b, i) in slide.tabel.baris" :key="i" :class="{ done: slide.belajar && centang[kunciC(slide.id, i)] }">
                    <td v-if="slide.belajar"><input v-model="centang[kunciC(slide.id, i)]" type="checkbox" :aria-label="'Hari ' + b[0] + ' selesai'" /></td>
                    <td v-for="(c, j) in b" :key="j">{{ c }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="slide.belajar" class="small mute">{{ jumlahCentang(slide.id) }} dari 7 hari selesai.</p>
            </div>
            <figure v-if="diagram" class="gambar">
              <PolaDiagram :diagram="diagram" :w="260" :h="150" />
              <figcaption class="small mute">Bentuk ideal (bullish). Bearish adalah cerminannya.</figcaption>
            </figure>
          </div>
          <p v-if="slide.rujukan" class="rujukan small mute">Rujukan: {{ slide.rujukan }}</p>
        </template>
      </article>
      <footer class="nav">
        <button type="button" class="btn" :disabled="ke === 0" @click="mundur">‹ Sebelumnya</button>
        <span class="small mute">Panah kiri/kanan untuk pindah slide</span>
        <button v-if="slide?.alat" type="button" class="btn coba" @click="emit('coba', slide.alat)">Coba di chart: {{ NAMA_ALAT[slide.alat] }}</button>
        <button type="button" class="btn" :disabled="ke === totalSlide - 1" @click="maju">Berikutnya ›</button>
      </footer>
      <p class="small mute sumber">Ringkasan dengan kata sendiri dari Scott M. Carney, <i>Harmonic Trading Vol. 1</i> (2010, terjemahan Indonesia), disesuaikan untuk saham BEI. Bahan belajar, bukan saran investasi.</p>
    </div>
    <HarmonicPresentasi v-if="presentasi" :mulai="ke" @tutup="presentasi = false" @pindah="v => { ke = v }" @coba="cobaDariPresentasi" />
  </section>
</template>

<style scoped>
.mt{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;align-items:start}
.isi{background:var(--sheet);border:1px solid var(--rule);border-radius:8px;padding:10px;position:sticky;top:10px;max-height:calc(100vh - 40px);overflow:auto}
.isi p{margin:0 0 6px}
.isi ol{margin:2px 0 6px;padding-left:20px;display:grid;gap:1px;font-size:12.5px}
.grup summary{cursor:pointer;font-size:13px;padding:4px 2px;color:var(--ink-2);border-radius:4px}
.grup summary.kini{color:var(--ink);font-weight:700}
.unduhM{width:100%;margin-bottom:8px}
.mulai{width:100%;margin-bottom:6px;background:var(--accent);color:var(--sheet);border-color:var(--accent);font-weight:700}
.prosa{margin:0 0 10px;font-size:15px;line-height:1.65;color:var(--ink);text-align:justify}
.rujukan{margin:14px 0 0;border-top:1px solid var(--rule-2);padding-top:6px}
.isi button{background:none;border:0;padding:3px 4px;text-align:left;color:var(--ink-2);cursor:pointer;font:inherit;border-radius:4px;width:100%}
.isi button:hover{background:var(--zebra);color:var(--ink)}
.isi button.on{color:var(--accent-ink);background:var(--accent-soft);font-weight:700}
.panggung{display:grid;gap:8px;min-width:0}
.prog{height:4px;background:var(--rule-2);border-radius:2px;overflow:hidden}
.prog i{display:block;height:100%;background:var(--accent);transition:width .2s}
.slide{background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:26px 30px;min-height:430px;box-shadow:var(--shadow)}
.slide header{margin-bottom:14px}
.no{font:600 12px var(--f-data);color:var(--ink-2)}
.slide h2{font-family:var(--f-display);font-size:28px;margin:4px 0 2px;color:var(--ink)}
.sub{margin:0;color:var(--ink-2);font-size:15px}
.isiSlide{display:grid;gap:20px}
.isiSlide.dg{grid-template-columns:minmax(0,1fr) 270px}
.poin{margin:0 0 6px;padding-left:20px;display:grid;gap:8px;font-size:15px;line-height:1.55;color:var(--ink)}
.cek{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:15px}
.cek label{display:flex;gap:8px;align-items:flex-start;cursor:pointer}
.tb{border-collapse:collapse;font-size:14px;margin-top:12px;width:100%}
.tb th,.tb td{border-bottom:1px solid var(--rule-2);padding:7px 10px;text-align:left;vertical-align:top}
.tb th{color:var(--ink-2);font-weight:600;background:var(--sheet-2)}
.tb tr.done td{color:var(--good)}
.gambar{margin:0;border:1px solid var(--rule);border-radius:8px;padding:10px;background:var(--sheet-2);align-self:start}
.gambar figcaption{margin-top:4px}
.nav{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.nav .mute{margin-right:auto}
.coba{background:var(--accent);color:var(--sheet);border-color:var(--accent)}
.up{color:var(--good)}.dn{color:var(--strong)}.mute{color:var(--ink-2)}.small{font-size:12px}
.sumber{margin:0}
@media (max-width: 900px){
  .mt{grid-template-columns:1fr}
  .isi{position:static}
  .isiSlide.dg{grid-template-columns:1fr}
  .slide{padding:18px}
}
</style>
