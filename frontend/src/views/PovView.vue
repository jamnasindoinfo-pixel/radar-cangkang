<script setup>
// POV: analisa mendalam per saham (cari kode BEI), pola pikir akun Stockbit prioritas + trending (dari posting ide
// publik), dan ringkasan metode KakdrWay (kakdr.com).
import { computed, onMounted, ref, watch } from 'vue'
import { api, loadJson } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'
import PovDetail from '../components/PovDetail.vue'
import PovDalam from '../components/PovDalam.vue'
import PovAh from '../components/PovAh.vue'

// tertanam: tampil sebagai tab di halaman IHSG (judul halaman sudah ada di sana).
defineProps({ tertanam: { type: Boolean, default: false } })

const data = ref(null), err = ref(''), kd = ref(null)
// Analisa KakdrWay disembunyikan sampai tombolnya diklik.
const kdOpen = ref(false)
// Hasil screening KakdrWay dimuat saat bagian dibuka pertama kali.
const kdScr = ref(null)
watch(kdOpen, v => { if (v && !kdScr.value) api.get('/api/kakdr-screen').then(r => { kdScr.value = r }, () => { kdScr.value = { rows: [], dinilai: 0, catatan: 'Screening gagal dimuat.' } }) })
// Pola pikir per akun juga disembunyikan sampai diklik.
const polaOpen = ref(false)
// POV AH (portofolio Andry Hakim + screening saham beredar sedikit) juga dimuat saat dibuka.
const ahOpen = ref(false)
// POV dan KakdrWay dimuat paralel: tombol KakdrWay tidak menunggu data POV.
onMounted(() => {
  api.get('/api/pov').then(v => { data.value = v }, e => { err.value = e.message })
  loadJson('kakdrway.json').then(v => { kd.value = v }, () => {})
})
// Ringkasan pola pikir satu akun (kalimat baku dari data posting).
function pola(u) {
  const [s1, s2] = u.styles
  const out = []
  if (s1?.n) out.push(`Gaya dominan ${s1.k.toLowerCase()} (${s1.pct}% posting)${s2?.n ? `, diikuti ${s2.k.toLowerCase()} (${s2.pct}%)` : ''}.`)
  if (u.horizon) out.push(`Horizon cenderung ${u.horizon}.`)
  out.push(u.avgChars < 90 ? 'Posting singkat: lebih banyak sinyal dan kode saham daripada argumen.' : u.avgChars > 600 ? 'Posting panjang: argumen dan data diuraikan rinci.' : 'Posting sedang: sinyal disertai alasan singkat.')
  if (u.radarHits.length) out.push(`Membahas ${u.radarHits.length} saham radar backdoor: ${u.radarHits.slice(0, 5).join(', ')}.`)
  return out
}
const users = computed(() => data.value?.users || [])
// Akun yang detailnya sedang dibuka (klik kartu).
const buka = ref(null)

// Cari saham BEI mana pun (/api/kode-bei) untuk analisa mendalam; tidak memasukkan saham ke radar.
const q = ref(''), kodeBei = ref(null), pilih = ref('')
watch(q, v => {
  if (v.trim() && kodeBei.value === null) {
    kodeBei.value = []
    api.get('/api/kode-bei').then(r => { kodeBei.value = r.kode || [] }, () => { kodeBei.value = [] })
  }
})
const saranCari = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (s.length < 2 || !kodeBei.value) return []
  const cocok = kodeBei.value.filter(k => k.t.toLowerCase().startsWith(s) || (s.length >= 3 && (k.nama || '').toLowerCase().includes(s)))
  return cocok.sort((a, b) => (b.t.toLowerCase() === s) - (a.t.toLowerCase() === s) || a.t.localeCompare(b.t)).slice(0, 8)
})
// Tombol "Analisa" di screening KakdrWay: buka analisa mendalam saham itu di bagian atas halaman.
function analisa(t) {
  pilih.value = t
  document.querySelector('.cari-dalam')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const namaPilih = computed(() => (kodeBei.value || []).find(k => k.t === pilih.value)?.nama || '')
</script>

<template>
  <div class="pov">
    <header v-if="!tertanam">
      <h1>POV</h1>
      <p class="small ket">Membaca pikiran pengendali: afiliasi, potensi backdoor, arah saham, dan jejak bandar. Bukan rekomendasi beli/jual.</p>
    </header>
    <section class="cari-dalam">
      <p class="small ket"><b>Analisa mendalam</b>: cari saham BEI mana pun untuk mengetahui tujuan pengendalinya (bisa diunduh PDF).</p>
      <input v-model="q" type="search" class="cari" placeholder="Cari saham BEI untuk analisa mendalam (kode atau nama)" aria-label="Cari saham untuk analisa mendalam" />
      <div v-if="saranCari.length" class="sar-wrap">
        <button v-for="k in saranCari" :key="k.t" type="button" class="sar" :class="{ on: pilih === k.t }" :title="k.nama" @click="pilih = k.t">
          <b>{{ k.t }}</b><span v-if="k.nama">{{ k.nama.replace(/ Tbk\.?$/i, '') }}</span></button>
      </div>
      <section v-if="pilih" class="luarpanel">
        <div class="lh"><h2>{{ pilih }}<span v-if="namaPilih" class="muted"> · {{ namaPilih }}</span></h2>
          <button type="button" class="btn" @click="pilih = ''">Tutup</button></div>
        <PovDalam :key="pilih" :ticker="pilih" />
      </section>
    </section>

    <p v-if="err" class="muted">Gagal memuat POV: {{ err }}</p>
    <p v-else-if="!data" class="muted">Memuat…</p>
    <p v-else-if="!users.length" class="muted">Data POV sedang disiapkan server; coba lagi beberapa menit lagi.</p>

    <section v-if="users.length" class="rule-top">
      <!-- Pola pikir per akun disembunyikan sampai tombolnya diklik (sama seperti Analisa KakdrWay). -->
      <button type="button" class="btn kdbtn" :aria-expanded="String(polaOpen)" aria-controls="pola-isi" @click="polaOpen = !polaOpen">
        Pola pikir per akun <span class="muted">({{ users.length }} akun)</span> <span aria-hidden="true">{{ polaOpen ? '▴' : '▾' }}</span>
      </button>
      <p class="small ket">Gaya, saham incaran, dan ketepatan akun Stockbit prioritas & trending.</p>
      <div v-if="polaOpen" id="pola-isi" class="cards">
        <article v-for="u in users" :key="u.username" class="card klik" tabindex="0" role="button" :aria-label="'Detail akun ' + u.username" @click="buka = u" @keydown.enter.self="buka = u">
          <div class="ch">
            <a :href="u.url" target="_blank" rel="noopener" @click.stop><b>@{{ u.username }}</b></a>
            <span v-if="u.priority" class="tag t-now">prioritas</span><span v-if="u.trending" class="tag t-warn">trending</span>
            <span v-if="u.hit?.rate != null" class="tag" :class="u.hit.rate >= 60 ? 't-good' : u.hit.rate >= 40 ? 't-calm' : 't-strong'">ketepatan {{ u.hit.rate }}%</span>
            <span class="small muted more">Klik untuk detail ›</span>
          </div>
          <p class="small muted">{{ u.posts }} posting ide ({{ u.from ? fmtDate(u.from) : '–' }} – {{ u.to ? fmtDate(u.to) : '–' }}) · {{ fmt(u.perDay, 1) }}/hari · rata-rata {{ fmt(u.avgLikes, 0) }} suka<template v-if="u.followers"> · {{ fmt(u.followers, 0) }} pengikut</template><template v-if="u.terbatas"> · data terbatas (posting terbaru saja)</template></p>
          <ul class="small pola"><li v-for="x in pola(u)" :key="x">{{ x }}</li></ul>
          <div class="sty">
            <span v-for="s in u.styles.filter(x => x.n)" :key="s.k" class="st"><i :style="{ width: Math.max(4, s.pct) + '%' }"></i>{{ s.k }} {{ s.pct }}%</span>
          </div>
          <h4>Saham incaran</h4>
          <div class="tk">
            <span v-for="e in u.tickers.slice(0, 8)" :key="e.t" class="tag" :class="e.nada === 'bullish' ? 't-good' : e.nada === 'bearish' ? 't-strong' : 't-calm'" :title="e.sample">
              <RouterLink v-if="e.radar" :to="'/emiten/' + e.t" @click.stop>{{ e.t }}</RouterLink><template v-else>{{ e.t }}</template> ×{{ e.n }}
            </span>
          </div>
          <details v-if="u.latest.length" class="small" @click.stop>
            <summary>Posting terbaru</summary>
            <ul><li v-for="p in u.latest" :key="p.url"><a :href="p.url" target="_blank" rel="noopener">{{ fmtDate(p.d) }}</a> · {{ p.text }}</li></ul>
          </details>
        </article>
      </div>
      <template v-if="polaOpen">
        <h3 class="rek-j">Cara membaca pola pikir akun</h3>
        <ol class="small rek">
          <li>Jadikan saham yang ramai dibahas akun sebagai <b>radar ide</b>, bukan alasan membeli: saham yang ramai dibahas sering sudah naik lebih dulu.</li>
          <li>Akun bergaya momentum/scalping cocok untuk membaca arus jangka pendek; akun bergaya aksi korporasi lebih relevan untuk saham backdoor yang bergantung pada dokumen.</li>
          <li>Cocokkan nada akun dengan <b>analisa mendalam</b> di atas: bila akun bullish tetapi data kepemilikan menunjukkan pengendali melepas saham, perlakukan sebagai tanda euforia.</li>
          <li>Perhatikan ketika beberapa akun prioritas berbalik bearish bersamaan pada saham yang sama: sering menjadi tanda distribusi.</li>
          <li>Terapkan disiplin dana ala KakdrWay: uang dingin, semampu siap hilang, dan masuk bertahap.</li>
        </ol>
      </template>
    </section>


    <section class="rule-top">
      <button type="button" class="btn kdbtn" :aria-expanded="String(ahOpen)" aria-controls="ah-isi" @click="ahOpen = !ahOpen">
        POV AH <span class="muted">(portofolio Andry Hakim, screening saham beredar sedikit)</span> <span aria-hidden="true">{{ ahOpen ? '▴' : '▾' }}</span>
      </button>
      <p class="small ket">Saham yang dipegang AH dan saham BEI lain dengan ciri serupa: saham beredar sedikit, porsi publik kecil, tidak sedang disuspensi.</p>
      <PovAh v-if="ahOpen" id="ah-isi" @analisa="analisa" />
    </section>

    <PovDetail v-if="buka" :u="buka" @close="buka = null" />

    <section v-if="kd" class="kdmore">
      <button type="button" class="more" :aria-expanded="String(kdOpen)" aria-controls="kd-isi" @click="kdOpen = !kdOpen">
        {{ kdOpen ? 'Tutup' : 'More…' }}<span v-if="kdOpen" class="muted"> · Analisa KakdrWay ({{ kd.julukan }})</span></button>
      <div v-if="kdOpen" id="kd-isi">
      <!-- Screening KakdrWay otomatis atas Key Stats seluruh BEI (skor > 6,5). -->
      <h3 class="rek-j">Saham lolos screening KakdrWay</h3>
      <p v-if="!kdScr" class="small muted">Memuat screening…</p>
      <template v-else>
        <p class="small muted">{{ kdScr.dinilai }} emiten dinilai · {{ kdScr.rows.length }} lolos (skor &gt; 6,5) · diperbarui {{ kdScr.updated }}.
          A pisau jatuh (≥50% dari tertinggi 52 minggu), B1 PBV &lt; 1, B2 DER &lt; 1, B3 ROE positif, C dividen.</p>
        <p v-if="kdScr.catatan" class="small c-strong">{{ kdScr.catatan }}</p>
        <div v-if="kdScr.rows.length" class="scroll">
          <table class="ledger small">
            <thead><tr><th>Saham</th><th class="num">Skor</th><th class="num">Harga</th><th class="num">Turun dari puncak</th><th class="num">PBV</th>
              <th class="num">DER</th><th class="num">ROE</th><th class="num">Div. yield</th><th>Lolos</th><th></th></tr></thead>
            <tbody><tr v-for="r in kdScr.rows" :key="r.t">
              <td><b>{{ r.t }}</b> <span v-if="r.baru" class="tag t-now">baru</span><span v-if="r.radar" class="tag t-warn">radar</span><span v-if="r.backdoor != null" class="tag" :class="r.backdoor >= 40 ? 't-warn' : 't-calm'" title="Skor potensi backdoor dari analisa mendalam terakhir">backdoor {{ r.backdoor }}</span>
                <div class="muted">{{ r.nama }}</div></td>
              <td class="num"><b>{{ fmt(r.skor, 1) }}</b></td>
              <td class="num">{{ r.harga ? fmt(r.harga, 0) : '–' }}</td>
              <td class="num">{{ r.turun == null ? '–' : '−' + fmt(r.turun, 1) + '%' }}</td>
              <td class="num">{{ r.pbv == null ? '–' : fmt(r.pbv, 2) + '×' }}</td>
              <td class="num">{{ r.der == null ? '–' : fmt(r.der, 2) + '×' }}</td>
              <td class="num">{{ r.roe == null ? '–' : fmt(r.roe, 1) + '%' }}</td>
              <td class="num">{{ r.dy == null ? '–' : fmt(r.dy, 1) + '%' }}</td>
              <td><span v-for="(ok, k) in r.lolos" :key="k" class="tag" :class="ok ? 't-good' : 't-calm'">{{ k }}</span></td>
              <td><button type="button" class="btn" :aria-label="'Analisa mendalam ' + r.t" @click="analisa(r.t)">Analisa</button></td>
            </tr></tbody>
          </table>
        </div>
        <p v-if="kdScr.keluar?.length" class="small muted">Keluar dari daftar sejak pembaruan hari sebelumnya: {{ kdScr.keluar.map(x => x.t).join(', ') }}.</p>
        <p class="small muted">Tanda: <b>baru</b> = baru lolos dibanding hari sebelumnya · <b>radar</b> = ada di radar backdoor · <b>backdoor</b> = skor potensi backdoor dari analisa mendalam terakhir. Klik <b>Analisa</b> untuk analisa mendalam.</p>
      </template>
      <div class="kd">
        <div>
          <h4>Screening standar</h4>
          <dl><div v-for="x in kd.screening" :key="x.k"><dt>{{ x.k }}</dt><dd class="small">{{ x.isi }}</dd></div></dl>
          <p class="small muted">{{ kd.skor }}</p>
        </div>
        <div>
          <h4>Pengelolaan posisi</h4>
          <ul class="small"><li v-for="x in kd.kelola" :key="x">{{ x }}</li></ul>
          <h4>Siklus dividen 4-4-4</h4>
          <ul class="small"><li v-for="x in kd.siklus444" :key="x.fase"><b>{{ x.fase }}:</b> {{ x.isi }}</li></ul>
        </div>
      </div>
      <h4>Relevansi terhadap saham backdoor</h4>
      <ul class="small"><li v-for="x in kd.terhadapBackdoor" :key="x">{{ x }}</li></ul>
      <h4>Artikel</h4>
      <ul class="small"><li v-for="a in kd.artikel" :key="a.url"><a :href="a.url" target="_blank" rel="noopener">{{ a.judul }}</a> <span class="muted">· {{ fmtDate(a.d) }}</span></li></ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Semua keterangan bagian: lebar, warna, jarak baris, dan jarak bawah yang sama. */
.more{background:none;border:0;padding:0;font:inherit;font-size:13px;color:var(--ink-2);cursor:pointer;text-decoration:underline}
.ket{margin:6px 0 10px;color:var(--ink-2);max-width:110ch;line-height:1.55}
.cari-dalam{margin:0}
/* Jarak antarbagian cukup dari gap .pov (14px): keterangan pertama/terakhir tanpa margin tambahan. */
header .ket{margin-bottom:0}.cari-dalam > .ket:first-child{margin-top:0}
.cari-dalam .cari{width:100%;max-width:520px;padding:8px 10px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:inherit;font:inherit}
.sar-wrap{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.sar{display:inline-flex;align-items:baseline;gap:8px;padding:8px 14px;border:1px solid var(--rule);border-left:4px solid var(--now-ink);
  border-radius:8px;background:var(--sheet);color:var(--ink);font:inherit;font-size:15px;cursor:pointer}
.sar b{font-size:16px;letter-spacing:.02em}.sar span{color:var(--ink-2);font-size:14px}
.sar:hover,.sar:focus-visible,.sar.on{border-color:var(--now-ink)}
.luarpanel{border:1px solid var(--rule);border-left:4px solid var(--now-ink);background:var(--sheet);padding:10px 14px;margin:8px 0 14px}
.lh{display:flex;justify-content:space-between;align-items:center;gap:10px}.lh h2{margin:4px 0}
.pov{display:flex;flex-direction:column;gap:14px}
header h1{margin:0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
.card{border:1px solid var(--rule);background:var(--sheet);padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.card.klik{cursor:pointer;transition:box-shadow .2s,border-color .2s}.card.klik:hover,.card.klik:focus-visible{border-color:var(--now-ink);box-shadow:0 2px 10px rgba(0,0,0,.08)}
.more{margin-left:auto}
.ch{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.pola{margin:0;padding-left:18px}
.sty{display:flex;flex-direction:column;gap:3px}
.st{position:relative;font-size:11.5px;padding:1px 6px;z-index:0}
.st i{position:absolute;left:0;top:0;bottom:0;background:var(--sheet-2);z-index:-1}
.tk{display:flex;flex-wrap:wrap;gap:5px}
h4{margin:6px 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.num{text-align:right}
.rek-j{margin:14px 0 4px;font-size:15px}
.rek{padding-left:20px;display:flex;flex-direction:column;gap:4px;max-width:100ch}
.kdbtn{font-weight:700;margin-bottom:8px}
.kd{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.kd dl div{margin-bottom:6px}
.kd dt{font-weight:700;font-size:13px}
.kd dd{margin:0}
</style>
