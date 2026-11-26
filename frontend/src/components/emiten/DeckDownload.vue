<script setup>
// Pemilih tema + tombol unduh .pptx/.pdf untuk presentasi apa pun. build({ PptxGenJS, choose, lastId, onStep })
// mengembalikan { pres, file, theme, sector }. Tema terakhir disimpan di peramban agar unduhan berikutnya
// memakai varian lain; pptxgenjs/jsPDF dimuat hanya saat tombol ditekan.
import { computed, ref } from 'vue'
import { toast } from '../../store.js'
import { SECTORS, THEMES } from '../../lib/deckThemes.js'

const props = defineProps({
  sectorId: { type: String, default: 'umum' },
  build: { type: Function, required: true },
  label: { type: String, default: 'presentasi' },
  // true: tampilkan juga tombol unduh versi infografis (build menerima variant: 'info').
  infografis: { type: Boolean, default: false },
})
const LAST_KEY = 'radar-cangkang.deckTheme.last'
const readLast = () => { try { return localStorage.getItem(LAST_KEY) || '' } catch { return '' } }
const saveLast = id => { try { localStorage.setItem(LAST_KEY, id) } catch { /* penyimpanan diblokir: abaikan */ } }

const sectorThemes = computed(() => THEMES[props.sectorId] || THEMES.umum)
const otherThemes = computed(() => SECTORS.filter(s => s.id !== props.sectorId).flatMap(s => (THEMES[s.id] || []).map(t => ({ ...t, sector: s.label }))))
const choice = ref('')          // '' = acak sesuai sektor
const showAll = ref(false)
const busy = ref(false)
const step = ref('')
const done = ref(null)          // { file, theme, slides, sector }

// kind: 'pptx' atau 'pdf'. PDF digambar ulang dari slide yang sama (jsPDF), jadi isi dan temanya identik.
async function download(kind = 'pptx', variant = '') {
  if (busy.value) return
  busy.value = kind + variant; done.value = null
  try {
    step.value = 'Memuat pustaka presentasi'
    const [{ default: PptxGenJS }, pdfLib] = await Promise.all([
      import('pptxgenjs'),
      kind === 'pdf' ? Promise.all([import('jspdf'), import('../../lib/deckPdf.js')]) : null,
    ])
    const { pres, file: pptxFile, theme, sector } = await props.build({ PptxGenJS, choose: choice.value, lastId: readLast(), onStep: s => { step.value = s }, variant })
    let file = pptxFile
    if (kind === 'pdf') {
      const [{ jsPDF }, { deckToPdf, pdfFileName }] = pdfLib
      step.value = 'Menyusun PDF'
      file = pdfFileName(file)
      ;(await deckToPdf(pres, jsPDF)).save(file)
    } else await pres.writeFile({ fileName: file })
    saveLast(theme.id)
    done.value = { file, theme, slides: pres.slides.length, sector }
  } catch (e) {
    toast(`Unduhan ${props.label} gagal dibuat: ` + (e?.message || e), true)
  } finally {
    busy.value = false; step.value = ''
  }
}
</script>

<template>
  <div class="dd">
    <h3 class="lbl">Tema</h3>
    <div class="themes" role="radiogroup" aria-label="Pilih tema presentasi">
      <button type="button" class="th auto" role="radio" :aria-checked="choice === ''" :class="{ on: choice === '' }" @click="choice = ''">
        <span class="sw shuffle" aria-hidden="true">⤨</span>
        <span><b>Acak</b><small>berganti tiap unduhan</small></span>
      </button>
      <button v-for="t in sectorThemes" :key="t.id" type="button" class="th" role="radio" :aria-checked="choice === t.id"
        :class="{ on: choice === t.id }" @click="choice = t.id">
        <span class="sw" :style="{ background: '#' + t.dark }" aria-hidden="true">
          <i :style="{ background: '#' + t.accent }" /><i :style="{ background: '#' + t.accent2 }" /><i :style="{ background: '#' + t.bg }" />
        </span>
        <span><b>{{ t.name }}</b><small>{{ t.head }}</small></span>
      </button>
    </div>
    <button type="button" class="link" @click="showAll = !showAll">{{ showAll ? 'Sembunyikan tema sektor lain' : 'Tema sektor lain' }}</button>
    <div v-if="showAll" class="themes small">
      <button v-for="t in otherThemes" :key="t.id" type="button" class="th" role="radio" :aria-checked="choice === t.id"
        :class="{ on: choice === t.id }" :title="t.sector" @click="choice = t.id">
        <span class="sw" :style="{ background: '#' + t.dark }" aria-hidden="true">
          <i :style="{ background: '#' + t.accent }" /><i :style="{ background: '#' + t.accent2 }" />
        </span>
        <span><b>{{ t.name }}</b><small>{{ t.sector }}</small></span>
      </button>
    </div>

    <div class="gos">
      <button type="button" class="btn go" :disabled="!!busy" @click="download('pptx')">
        {{ busy === 'pptx' ? (step || 'Menyiapkan') + '…' : `Unduh ${label} (.pptx)` }}
      </button>
      <button type="button" class="btn go" :disabled="!!busy" @click="download('pdf')">
        {{ busy === 'pdf' ? (step || 'Menyiapkan') + '…' : `Unduh ${label} (.pdf)` }}
      </button>
      <template v-if="infografis">
        <button type="button" class="btn go info" :disabled="!!busy" @click="download('pptx', 'info')">
          {{ busy === 'pptxinfo' ? (step || 'Menyiapkan') + '…' : `Unduh ${label} versi infografis (.pptx)` }}
        </button>
        <button type="button" class="btn go info" :disabled="!!busy" @click="download('pdf', 'info')">
          {{ busy === 'pdfinfo' ? (step || 'Menyiapkan') + '…' : `Unduh ${label} versi infografis (.pdf)` }}
        </button>
      </template>
    </div>
    <p v-if="done" class="ok" role="status">
      Tersimpan: <b>{{ done.file }}</b> · {{ done.slides }} {{ /\.pdf$/.test(done.file) ? 'halaman' : 'slide' }} · tema {{ done.theme.name }}<template v-if="done.sector"> ({{ done.sector }})</template>.
      Unduhan berikutnya otomatis memakai varian lain.
    </p>
  </div>
</template>

<style scoped>
.lbl{margin:0 0 8px}
.themes{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-bottom:8px}
.themes.small{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.th{display:flex;align-items:center;gap:10px;text-align:left;padding:8px;border:1px solid var(--rule);background:transparent;cursor:pointer;color:inherit;font:inherit}
.th:hover{border-color:var(--rule-2)}
.th.on{outline:2px solid var(--now-ink);outline-offset:-1px}
.th b{display:block;font-size:13px}
.th small{display:block;font-size:11px;opacity:.7}
.sw{flex:none;width:44px;height:30px;border-radius:4px;display:flex;align-items:flex-end;gap:2px;padding:4px;box-sizing:border-box}
.sw i{flex:1;height:8px;border-radius:2px}
.sw.shuffle{background:var(--rule-2);align-items:center;justify-content:center;font-size:18px}
.link{background:none;border:0;padding:0;margin:2px 0 12px;color:var(--now-ink);cursor:pointer;font:inherit;text-decoration:underline}
.gos{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.go{width:100%;padding:10px;font-weight:600}
.ok{margin:10px 0 0;font-size:13px}
@media (max-width:760px){ .gos{grid-template-columns:1fr} }
</style>
