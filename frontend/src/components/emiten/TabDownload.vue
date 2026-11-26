<script setup>
// Unduh seluruh hasil analisa emiten sebagai presentasi PowerPoint atau PDF. Tema mengikuti bisnis emiten dan
// berganti tiap unduhan (pemilih tema & tombol di DeckDownload).
import { computed, ref } from 'vue'
import { store, storyOf, getBenchmark } from '../../store.js'
import { api } from '../../api.js'
import { collectDeck } from '../../lib/deckData.js'
import { buildDeck, deckFileName } from '../../lib/deck.js'
import { buildInfoDeck, infoFileName } from '../../lib/deckInfo.js'
import { sectorOf, pickTheme } from '../../lib/deckThemes.js'
import DeckDownload from './DeckDownload.vue'
import InfografisInteraktif from './InfografisInteraktif.vue'

const props = defineProps({ ticker: { type: String, required: true } })
// Infografis interaktif (layar penuh di situs) dengan data yang sama dengan presentasi unduhan.
const interaktif = ref(false)

// Perkiraan sektor sebelum data lengkap dimuat (dipakai untuk pratinjau tema); sektor final dihitung ulang saat unduh.
const guess = computed(() => {
  const t = props.ticker, it = store.items.find(x => x.ticker === t)
  const a = store.aset?.[t]?.aset
  return sectorOf({ baru: (it ? storyOf(t)?.baru : '') || store.verified?.[t]?.baru, aset: [a?.sektor, a?.nama].filter(Boolean).join(' '), nama: it?.name })
})

// Isi presentasi ringkas (maks. ±26 slide, poin penting saja), berurutan seperti karya ilmiah: profil & data,
// analisa, lalu rekomendasi dan kesimpulan di akhir (lihat buildDeck di lib/deck.js).
const SECTIONS = [
  // Ringkasan eksekutif di awal: headline transaksi (diagram struktur) dan rekomendasi investasi singkat.
  ['Ringkasan', [['Ringkasan transaksi', 'headline rencana korporasi, diagram pengendali → emiten ← aset, angka kunci'],
    ['Ringkasan rekomendasi', 'tindakan, area beli, target, batas risiko, alasan & risiko']]],
  ['Profil', [['Profil perusahaan', 'angka kunci, pemegang saham, potensi target harga'], ['Pengurus', 'direksi & komisaris']]],
  ['Story & Pengendali', [['Pengendali', 'struktur & aktor'], ['Pengendali & key person', 'UBO, harga masuk, riwayat hukum'],
    ['Transformasi bisnis', 'bisnis lama → aset injeksi → bisnis baru'], ['Progres', 'tonggak transaksi']]],
  ['Berita', [['Berita terkini', 'berita material & kesimpulannya'], ['Penjelasan bursa', 'memo riset & analisa per pertanyaan BEI']]],
  ['Analisa', [['Tesis analis', '4 poin alasan sikap'], ['Enam dimensi', 'skor & alasan singkat'],
    ['Aset & valuasi', 'bila tidak ada rights issue'], ['Kasus naik vs turun', 'pendorong, risiko, catatan analis']]],
  // Bagian Rights Issue: inti analisa rights issue (hanya bila ada rencana penambahan modal).
  ['Rights Issue', [['Angka kunci', 'nilai penerbitan, dana tunai, harga, dilusi'], ['Rencana korporasi', 'langkah, pihak, nilai, status'], ['Kewajaran aset', 'wajar atau tidak & alasannya'],
    ['Model bisnis & laba', 'cara menghasilkan laba & proyeksi'], ['Kebutuhan dana', 'nilai penerbitan vs nilai aset'],
    ['Simulasi rasio', 'harga RI, dana, harga dibutuhkan'], ['Simulasi valuasi', 'valuasi target & sudut pandang pengendali'],
    ['Kelayakan investasi', 'laba sebelum/sesudah, layak atau tidak']]],
  ['Teknikal', [['Harga 1 tahun', 'grafik & siklus'], ['Teknikal', 'meter sinyal'], ['Rencana transaksi', 'masuk/keluar']]],
  ['Spekulasi', [['Skenario', 'tangga harga']]],
  ['Penutup', [['Rekomendasi', 'tindakan, area beli, batas risiko, target'], ['Rencana aksi', 'bila terkonfirmasi / sekarang / bila gagal'],
    ['Kesimpulan', 'rekomendasi & skor'], ['Lampiran', 'sumber & celah data']]],
]
// Nomor slide berurutan lintas bagian (sampul tidak dihitung).
const NUMBERED = SECTIONS.reduce((acc, [sec, items]) => { const start = acc.n; acc.list.push([sec, items.map((x, k) => [start + k + 1, ...x])]); acc.n += items.length; return acc }, { n: 0, list: [] }).list

// variant 'info' = versi infografis: poster A4 portrait 2 halaman (lib/deckInfo.js), bukan slide 16:9.
async function build({ PptxGenJS, choose, lastId, onStep, variant }) {
  const d = await collectDeck(props.ticker, { store, api, storyOf, getBenchmark, onStep })
  const theme = pickTheme(d.sector.id, { lastId, choose })
  onStep('Menyusun slide')
  if (variant === 'info') return { pres: buildInfoDeck(PptxGenJS, d, theme), file: infoFileName(props.ticker, d.date, theme), theme, sector: d.sector.label }
  return { pres: buildDeck(PptxGenJS, d, theme), file: deckFileName(props.ticker, d.date, theme), theme, sector: d.sector.label }
}
</script>

<template>
  <section class="rule-top">
    <div class="bar">
      <h2 class="lbl">Unduh presentasi {{ ticker }}</h2>
      <span class="muted">Sektor terdeteksi: <b>{{ guess.label }}</b></span>
    </div>

    <div class="grid">
      <div class="pane">
        <button type="button" class="btn ig-btn" @click="interaktif = true">
          <b>Buka infografis interaktif</b><small>angka berjalan, analogi rumah, simulasi skenario, garis waktu yang bisa diklik</small>
        </button>
        <DeckDownload :sector-id="guess.id" :build="build" :infografis="true" />
      </div>

      <div class="pane">
        <h3 class="lbl">Isi presentasi</h3>
        <div v-for="[sec, items] in NUMBERED" :key="sec" class="sec">
          <h4 class="sh">{{ sec }}</h4>
          <ol class="slides">
            <li v-for="[n, a, b] in items" :key="a"><span class="n">{{ n }}</span><b>{{ a }}</b><small>{{ b }}</small></li>
          </ol>
        </div>
        <p class="muted note">Versi infografis: poster vertikal A4 dua halaman (angka kunci berikon, diagram transaksi, rekomendasi, aset dalam angka, garis waktu, katalis vs risiko, peta harga), hampir tanpa paragraf. Slide tanpa data dilewati otomatis. Data diambil saat tombol ditekan, sama dengan yang tampil di tab lain.</p>
      </div>
    </div>
    <InfografisInteraktif v-if="interaktif" :ticker="ticker" @close="interaktif = false" />
  </section>
</template>

<style scoped>
.bar{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.lbl{margin:0 0 8px}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
.pane{background:var(--sheet);border:1px solid var(--rule);padding:14px}
.sec{margin-bottom:10px}
.sh{margin:6px 0 4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.65}
.slides{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px}
.slides li{display:grid;grid-template-columns:22px 1fr;column-gap:8px;align-items:baseline}
.slides .n{grid-row:span 2;font-weight:700;opacity:.55;text-align:right}
.slides b{font-size:13px}
.slides small{font-size:11px;opacity:.7}
.note{margin:12px 0 0;font-size:12px}
.ig-btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;margin-bottom:14px;padding:12px 14px;text-align:left;background:var(--accent);color:var(--accent-ink,#fff);border:0;border-radius:4px;cursor:pointer}
.ig-btn b{font-size:15px}.ig-btn small{opacity:.85}
@media (max-width:760px){
  .grid{grid-template-columns:1fr}
  .slides{grid-template-columns:1fr}
}
</style>
