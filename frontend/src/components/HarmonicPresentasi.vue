<script setup>
// Mode presentasi tab Materi: slide 16:9 layar penuh dengan isi muncul bertahap (klik, spasi, atau panah kanan),
// transisi antarslide, diagram pola beranimasi, lab pola interaktif pada slide pola, ikhtisar semua slide (O),
// tanpa kuis (fokus materi). Esc keluar. Data sama dengan tampilan Materi biasa (lib/harmonikMateri.js).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BAGIAN, SLIDE, butirSlide, diagramAbcd } from '../lib/harmonikMateri.js'
import { RINGKAS } from '../lib/presentasiRingkas.js'
import PolaDiagram from './PolaDiagram.vue'
import PolaLab from './PolaLab.vue'
import { POLA, diagramIdeal } from '../lib/harmonikAlat.js'

const props = defineProps({ mulai: { type: Number, default: 0 } })
const emit = defineEmits(['tutup', 'coba', 'pindah'])
const NAMA_ALAT = { xabcd: 'XABCD', fib: 'Fib retracement', ext: 'Trend-based fib extension', elliott: 'Elliott', long: 'Long position', short: 'Short position' }
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

// Versi deck: ringkas (inti tiap bagian, bawaan) atau lengkap (seluruh materi). Pilihan diingat di browser.
let versiAwal = 'ringkas'
try { versiAwal = localStorage.getItem('radar-cangkang.hm-versi') === 'lengkap' ? 'lengkap' : 'ringkas' } catch {}
const versi = ref(versiAwal)
const deck = computed(() => versi.value === 'lengkap' ? SLIDE : RINGKAS)
const totalSlide = computed(() => deck.value.length)
const ke = ref(versi.value === 'lengkap' ? Math.min(SLIDE.length - 1, Math.max(0, props.mulai)) : 0)
const slide = computed(() => deck.value[ke.value] || null)
const butir = computed(() => butirSlide(slide.value))
const bertahap = ref(true)
// Butir pertama langsung tampil saat masuk slide (slide tidak tampak kosong); sisanya muncul per klik.
const awalLangkah = i => Math.min(1, butirSlide(deck.value[i]).length)
const langkah = ref(awalLangkah(ke.value))
const arah = ref('maju')
watch(ke, v => { if (versi.value === 'lengkap') emit('pindah', v) })
watch(versi, v => {
  try { localStorage.setItem('radar-cangkang.hm-versi', v) } catch {}
  ke.value = 0; langkah.value = awalLangkah(0); ikhtisar.value = false
})
const tampil = j => !bertahap.value || j < langkah.value
const indeks = (jenis, i) => butir.value.findIndex(x => x.jenis === jenis && x.i === i)

function maju() {
  if (bertahap.value && langkah.value < butir.value.length) { langkah.value++; return }
  if (ke.value < totalSlide.value - 1) { arah.value = 'maju'; ke.value++; langkah.value = awalLangkah(ke.value) }
}
function mundur() {
  if (bertahap.value && langkah.value > awalLangkah(ke.value)) { langkah.value--; return }
  if (ke.value > 0) { arah.value = 'mundur'; ke.value--; langkah.value = butirSlide(deck.value[ke.value]).length }
}
function lompat(i) { arah.value = i >= ke.value ? 'maju' : 'mundur'; ke.value = i; langkah.value = awalLangkah(i); ikhtisar.value = false }

// Layar penuh dan keyboard. Listener capture + stopPropagation supaya pintasan aplikasi (F, angka, /) tidak ikut.
const akar = ref(), ikhtisar = ref(false)
async function layarPenuh() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await akar.value?.requestFullscreen?.() } catch {}
}
function tutup() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  emit('tutup')
}
function tombol(e) {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) && e.key !== 'Escape') return
  const k = e.key
  const aksi = {
    ArrowRight: maju, ' ': maju, PageDown: maju, Enter: maju, ArrowDown: maju,
    ArrowLeft: mundur, PageUp: mundur, Backspace: mundur, ArrowUp: mundur,
    Home: () => lompat(0), End: () => lompat(totalSlide.value - 1),
    Escape: () => { if (ikhtisar.value) ikhtisar.value = false; else tutup() },
    o: () => { ikhtisar.value = !ikhtisar.value }, O: () => { ikhtisar.value = !ikhtisar.value },
    f: layarPenuh, F: layarPenuh,
    b: () => { bertahap.value = !bertahap.value }, B: () => { bertahap.value = !bertahap.value },
  }[k]
  if (!aksi) return
  e.preventDefault(); e.stopPropagation()
  aksi()
}
// Klik di area slide = lanjut (kecuali klik pada tombol, tautan, input, atau lab).
function klikSlide(e) {
  if (e.target.closest('button, a, input, label, .lab')) return
  maju()
}
onMounted(() => {
  window.addEventListener('keydown', tombol, true)
  document.body.style.overflow = 'hidden'
  nextTick(() => akar.value?.focus())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', tombol, true)
  document.body.style.overflow = ''
})

// Pola X-A-B-C-D memakai lab interaktif; AB=CD dan Three Drives memakai diagram beranimasi.
const diagram = computed(() => {
  const k = slide.value?.pola
  if (!k || POLA[k]) return null
  return k === 'abcd' ? diagramAbcd('bullish') : diagramIdeal(k, 'bullish')
})
const noBagian = b => ROMAWI[BAGIAN.indexOf(b)] || ''
const bagianKini = computed(() => slide.value?.bagian || 'Lampiran')
const daftar = computed(() => deck.value.map((s, i) => ({ i, judul: s.judul, bagian: s.bagian })))

const centang = ref({})
</script>

<template>
  <div ref="akar" class="pres" tabindex="-1" role="dialog" aria-modal="true" aria-label="Presentasi materi Harmonic Pattern">
    <header class="atas">
      <span class="bag">Bagian {{ noBagian(bagianKini) }} · {{ bagianKini }}</span>
      <div class="kanan">
        <div class="versi" role="group" aria-label="Versi presentasi">
          <button type="button" :class="{ on: versi === 'ringkas' }" :aria-pressed="String(versi === 'ringkas')" @click="versi = 'ringkas'">Ringkas ({{ RINGKAS.length }})</button>
          <button type="button" :class="{ on: versi === 'lengkap' }" :aria-pressed="String(versi === 'lengkap')" @click="versi = 'lengkap'">Lengkap ({{ SLIDE.length }})</button>
        </div>
        <label class="tg"><input v-model="bertahap" type="checkbox" /> Tampil bertahap</label>
        <button type="button" class="ik" :aria-pressed="String(ikhtisar)" title="Ikhtisar semua slide (O)" @click="ikhtisar = !ikhtisar">Ikhtisar</button>
        <button type="button" class="ik" title="Layar penuh (F)" @click="layarPenuh">Layar penuh</button>
        <button type="button" class="ik tutup" title="Keluar (Esc)" aria-label="Keluar dari presentasi" @click="tutup">×</button>
      </div>
    </header>

    <div class="panggung" @click="klikSlide">
      <!-- Slide dipasang ulang per indeks (key) dengan animasi masuk saja; transisi keluar-masuk bisa tersangkut
           saat tombol ditekan cepat berturut-turut. -->
        <article :key="versi + ke" class="kanvas" :class="'masuk-' + arah">
          <template v-if="slide">
            <div class="kepala">
              <h1>{{ slide.judul }}</h1>
              <p v-if="slide.sub" class="sub">{{ slide.sub }}</p>
            </div>
            <div class="badan" :class="{ dua: slide.pola }">
              <div class="teks">
                <p v-for="(t, i) in slide.paragraf || []" :key="'p' + i" class="prosa" :class="{ sembunyi: !tampil(indeks('p', i)) }">{{ t }}</p>
                <ul v-if="slide.poin && !slide.periksa" class="poin">
                  <li v-for="(t, i) in slide.poin" :key="'l' + i" :class="{ sembunyi: !tampil(indeks('li', i)) }">{{ t }}</li>
                </ul>
                <ul v-if="slide.periksa" class="cek">
                  <li v-for="(t, i) in slide.poin" :key="'c' + i"><label><input v-model="centang[i]" type="checkbox" /> {{ t }}</label></li>
                </ul>
                <table v-if="slide.tabel" class="tb">
                  <thead><tr><th v-for="k in slide.tabel.kolom" :key="k">{{ k }}</th></tr></thead>
                  <tbody><tr v-for="(b, i) in slide.tabel.baris" :key="i" :class="{ sembunyi: !tampil(indeks('tr', i)) }"><td v-for="(c, j) in b" :key="j">{{ c }}</td></tr></tbody>
                </table>
              </div>
              <aside v-if="slide.pola" class="visual">
                <PolaDiagram v-if="diagram" :key="'d' + ke" :diagram="diagram" :w="300" :h="170" animasi />
                <PolaLab v-else :awal="slide.pola" />
                <p class="ket">{{ diagram ? 'Bentuk ideal (bullish); bearish adalah cerminannya.' : 'Geser titik atau klik nama pola untuk melihat syaratnya berubah.' }}</p>
              </aside>
            </div>
            <footer class="kaki">
              <span v-if="slide.rujukan">Rujukan: {{ slide.rujukan }}</span>
              <button v-if="slide.alat" type="button" class="coba" @click="emit('coba', slide.alat)">Coba di chart: {{ NAMA_ALAT[slide.alat] }}</button>
            </footer>
          </template>
        </article>
    </div>

    <footer class="bawah">
      <button type="button" class="nv" :disabled="ke === 0 && langkah <= awalLangkah(0)" aria-label="Sebelumnya" @click="mundur">‹</button>
      <div class="prog">
        <div class="bar"><i :style="{ width: (ke + 1) / totalSlide * 100 + '%' }"></i></div>
        <span>Slide {{ ke + 1 }} / {{ totalSlide }}<template v-if="bertahap && butir.length"> · butir {{ langkah }} / {{ butir.length }}</template></span>
      </div>
      <span class="pintas">→ / spasi lanjut · ← kembali · O ikhtisar · B bertahap · F layar penuh · Esc keluar</span>
      <button type="button" class="nv" :disabled="ke === totalSlide - 1" aria-label="Berikutnya" @click="maju">›</button>
    </footer>

    <Transition name="pudar">
      <div v-if="ikhtisar" class="ikhtisar" role="dialog" aria-label="Ikhtisar slide">
        <template v-for="b in BAGIAN" :key="b">
          <h2 v-if="daftar.some(x => x.bagian === b)">{{ noBagian(b) }}. {{ b }}</h2>
          <div class="grid">
            <button v-for="x in daftar.filter(y => y.bagian === b)" :key="x.i" type="button" class="kartu" :class="{ on: x.i === ke }" @click="lompat(x.i)">
              <span class="no">{{ x.i + 1 }}</span>{{ x.judul }}
            </button>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.pres{position:fixed;inset:0;z-index:200;background:var(--paper);display:grid;grid-template-rows:auto 1fr auto;outline:none}
.atas,.bawah{display:flex;align-items:center;gap:12px;padding:8px 18px;color:var(--ink-2);font-size:13px}
.atas{justify-content:space-between;border-bottom:1px solid var(--rule)}
.bag{font-weight:700;color:var(--accent-ink)}
.kanan{display:flex;gap:6px;align-items:center}
.versi{display:flex;border:1px solid var(--rule);border-radius:6px;overflow:hidden}
.versi button{border:0;background:var(--sheet);color:var(--ink-2);padding:4px 10px;font:600 12px var(--f-body);cursor:pointer}
.versi button.on{background:var(--accent);color:var(--sheet)}
.tg{display:flex;gap:4px;align-items:center;cursor:pointer}
.ik{border:1px solid var(--rule);background:var(--sheet);color:var(--ink);border-radius:6px;padding:4px 10px;cursor:pointer;font:600 12px var(--f-body)}
.ik[aria-pressed="true"]{background:var(--accent-soft);color:var(--accent-ink)}
.tutup{font-size:18px;line-height:1;padding:2px 10px}
.panggung{display:grid;place-items:center;padding:14px;overflow:hidden;min-height:0}
/* Kanvas 16:9 menyesuaikan layar; ukuran huruf mengikuti lebar kanvas (cqi). */
.kanvas{container-type:inline-size;width:min(100%, calc((100vh - 140px) * 16 / 9));aspect-ratio:16 / 9;background:var(--sheet);border:1px solid var(--rule);
  border-radius:14px;box-shadow:var(--shadow);padding:3.2cqi 4cqi 2.4cqi;display:grid;grid-template-rows:auto 1fr auto;overflow:auto;cursor:pointer}
.kepala h1{font-family:var(--f-display);font-size:3.6cqi;line-height:1.15;margin:0;color:var(--ink)}
.sub{margin:.5cqi 0 0;color:var(--ink-2);font-size:1.7cqi}
.badan{display:grid;gap:3cqi;margin-top:2cqi;min-height:0;align-content:start;overflow:auto}
.badan.dua{grid-template-columns:minmax(0, 1.25fr) minmax(0, 1fr)}
.prosa{font-size:1.65cqi;line-height:1.6;margin:0 0 1.2cqi;color:var(--ink)}
.poin{margin:0;padding-left:2.4cqi;display:grid;gap:.9cqi;font-size:1.6cqi;line-height:1.5;color:var(--ink)}
.cek{list-style:none;margin:0;padding:0;display:grid;gap:1cqi;font-size:1.7cqi}
.cek label{display:flex;gap:1cqi;cursor:pointer}
.tb{border-collapse:collapse;width:100%;font-size:1.4cqi;margin-top:1cqi}
.tb th,.tb td{border-bottom:1px solid var(--rule-2);padding:.7cqi 1cqi;text-align:left;vertical-align:top}
.tb th{background:var(--sheet-2);color:var(--ink-2)}
.tb td:first-child{font-weight:700}
/* Butir bertahap: tetap memakan tempat supaya tata letak tidak melompat. */
.prosa,.poin li,.tb tbody tr{transition:opacity .35s ease, transform .35s ease}
.sembunyi{opacity:0;transform:translateY(.6cqi)}
.visual{display:grid;gap:1cqi;align-content:start;font-size:1.3cqi;cursor:default}
/* Lab di dalam kanvas: diagram dibatasi tingginya supaya slider dan tombol pola tetap terlihat. */
.visual :deep(.gb){max-height:17cqi}
.visual :deep(.kontrol){gap:.4cqi}
.visual :deep(.pasang button){padding:.2cqi .8cqi}
.ket{margin:0;color:var(--ink-2);font-size:1.25cqi}
.kaki{display:flex;justify-content:space-between;align-items:center;gap:2cqi;margin-top:1.5cqi;font-size:1.2cqi;color:var(--ink-2);border-top:1px solid var(--rule-2);padding-top:1cqi}
.coba{border:0;background:var(--accent);color:var(--sheet);border-radius:8px;padding:.7cqi 1.6cqi;font:700 1.3cqi var(--f-body);cursor:pointer}
.bawah{border-top:1px solid var(--rule)}
.nv{width:40px;height:40px;border-radius:50%;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);font-size:22px;cursor:pointer;flex:none}
.nv:disabled{opacity:.35;cursor:default}
.prog{display:grid;gap:3px;min-width:200px}
.bar{height:4px;background:var(--rule-2);border-radius:2px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent);transition:width .3s}
.pintas{margin-left:auto;font-size:12px}
.ikhtisar{position:absolute;inset:52px 0 60px;background:var(--paper);overflow:auto;padding:16px 22px;z-index:2}
.ikhtisar h2{font-family:var(--f-display);font-size:16px;margin:14px 0 6px;color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.kartu{display:flex;gap:8px;align-items:flex-start;text-align:left;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);border-radius:8px;padding:10px;min-height:62px;cursor:pointer;font:13px var(--f-body)}
.kartu.on{border-color:var(--accent);background:var(--accent-soft)}
.kartu .no{font:700 12px var(--f-data);color:var(--ink-2)}
/* Animasi masuk slide sesuai arah navigasi. */
.masuk-maju{animation:masukKanan .3s ease-out}
.masuk-mundur{animation:masukKiri .3s ease-out}
@keyframes masukKanan{from{opacity:0;transform:translateX(30px)}}
@keyframes masukKiri{from{opacity:0;transform:translateX(-30px)}}
.pudar-enter-active,.pudar-leave-active{transition:opacity .2s}
.pudar-enter-from,.pudar-leave-to{opacity:0}
@media (prefers-reduced-motion: reduce){
  .masuk-maju,.masuk-mundur{animation:none}
  .prosa,.poin li,.tb tbody tr{transition:none}
}
@media (max-width: 900px){
  .kanvas{aspect-ratio:auto;width:100%;height:100%}
  .badan.dua{grid-template-columns:1fr}
  .kepala h1{font-size:6cqi}.sub{font-size:3.4cqi}.prosa,.poin{font-size:3.4cqi}.tb{font-size:3cqi}.visual,.kaki{font-size:3cqi}
  .pintas{display:none}
}
</style>
