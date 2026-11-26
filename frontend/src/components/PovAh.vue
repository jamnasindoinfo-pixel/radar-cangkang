<script setup>
// POV AH: saham yang dipegang Andry Hakim (KSEI >=1%, lewat PT berstatus indikasi, kurasi) dan screening saham BEI
// dengan ciri serupa: saham beredar sedikit, porsi publik kecil, nilai float tipis. Saham yang disuspensi disaring keluar.
import { computed, onMounted, ref } from 'vue'
import { api } from '../api.js'
import { big, fmt, fmtDate } from '../lib/domain.js'
import { jalurTeks, lembar, pilihRekomendasi, saringAh, trenTeks } from '../lib/povAh.js'

const emit = defineEmits(['analisa'])
const d = ref(null), err = ref('')
onMounted(() => { api.get('/api/pov-ah').then(v => { d.value = v }, e => { err.value = e.message }) })

// Baris yang sedang dibuka untuk analisa lebih dalam (kode saham).
const buka = ref('')
const togel = t => { buka.value = buka.value === t ? '' : t }

const maksSaham = ref(Infinity), maksFF = ref(Infinity), rekan = ref(false), cari = ref('')
const rows = computed(() => saringAh(d.value?.rows, { maksSaham: maksSaham.value, maksFF: maksFF.value, rekan: rekan.value, cari: cari.value }))
const rekanSet = computed(() => new Set((d.value?.rekan || []).map(r => r.nama)))
const pctId = v => v == null ? '–' : fmt(v, 2) + '%'
// Laba negatif: tanda minus di depan Rp.
const labaTxt = v => v < 0 ? '−' + big(-v) : big(v)
const nadaSkor = s => s >= 75 ? 't-strong' : s >= 60 ? 't-warn' : 't-calm'
const reko = computed(() => pilihRekomendasi(d.value?.rows, 5))
// Buka analisa baris di tabel screening; kosongkan saringan supaya barisnya pasti tampil.
function lihat(t) {
  cari.value = ''; maksSaham.value = Infinity; maksFF.value = Infinity; rekan.value = false
  buka.value = t
  setTimeout(() => document.getElementById('ah-' + t)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
}
</script>

<template>
  <div class="ah">
    <p v-if="err" class="muted">Gagal memuat POV AH: {{ err }}</p>
    <p v-else-if="!d" class="muted">Memuat…</p>
    <template v-else>
      <p class="small ket"><b>{{ d.profil.nama }}</b>: {{ d.profil.peran }}
        <a v-if="d.profil.peranSumber" :href="d.profil.peranSumber.url" target="_blank" rel="noopener">{{ d.profil.peranSumber.judul }}</a>
        <span v-if="d.profil.peranSumber" class="muted"> ({{ fmtDate(d.profil.peranSumber.tanggal) }})</span></p>

      <h3 class="j">Saham yang dipegang</h3>
      <div class="scroll">
        <table class="ledger small">
          <thead><tr><th>Saham</th><th>Jalur kepemilikan</th><th class="num">Saham beredar</th><th class="num">Publik</th>
            <th class="num">Nilai float</th><th class="num">Harga</th><th class="num">Pemegang ±3 bln</th><th class="num">Skor ciri</th><th></th></tr></thead>
          <tbody>
            <template v-for="r in d.portofolio" :key="r.t">
              <tr>
                <td><b>{{ r.t }}</b> <span v-if="r.suspen" class="tag t-strong">suspensi</span><span v-if="r.radar" class="tag t-warn">radar</span>
                  <div class="muted">{{ r.nama }}</div></td>
                <td><div v-for="j in r.jalur" :key="j.nama + j.jenis" :title="j.ket">{{ jalurTeks(j) }}</div></td>
                <td class="num">{{ lembar(r.saham) }}</td>
                <td class="num">{{ pctId(r.ff) }}</td>
                <td class="num">{{ big(r.nilaiFloat) }}</td>
                <td class="num">{{ r.harga ? fmt(r.harga, 0) : '–' }}</td>
                <td class="num" :class="trenTeks(r.tren).nada">{{ trenTeks(r.tren).teks }}</td>
                <td class="num"><span class="tag" :class="nadaSkor(r.skor)">{{ r.skor }}</span></td>
                <td><button type="button" class="btn" :aria-expanded="String(buka === r.t)" @click="togel(r.t)">{{ buka === r.t ? 'Tutup' : 'Detail' }}</button></td>
              </tr>
              <tr v-if="buka === r.t" class="dalam"><td colspan="9">
                <ul class="jl"><li v-for="j in r.jalur" :key="'k' + j.nama + j.jenis"><b>{{ jalurTeks(j) }}</b>: {{ j.ket }}
                  <template v-for="s in j.sumber || []" :key="s.url"> · <a :href="s.url" target="_blank" rel="noopener">{{ s.judul }}</a> ({{ fmtDate(s.tanggal) }})</template></li></ul>
                <p v-if="r.riwayat"><b>Riwayat:</b> {{ r.riwayat.ket }}
                  <template v-for="s in r.riwayat.sumber || []" :key="s.url"> · <a :href="s.url" target="_blank" rel="noopener">{{ s.judul }}</a> ({{ fmtDate(s.tanggal) }})</template></p>
                <ul><li v-for="x in r.ringkas" :key="x">{{ x }}</li></ul>
                <div v-if="r.notasi?.length" class="tk"><span v-for="n in r.notasi" :key="n.k" class="tag t-warn" :title="n.ket">notasi {{ n.k }}: {{ n.ket }}</span></div>
                <p v-if="r.pemegang.length" class="muted">Pemegang ≥1%: <span v-for="(p, i) in r.pemegang" :key="p.nama"><b v-if="rekanSet.has(p.nama.toUpperCase())">{{ p.nama }}</b><template v-else>{{ p.nama }}</template> {{ fmt(p.pct, 2) }}%<template v-if="i < r.pemegang.length - 1">, </template></span></p>
                <p v-if="r.laba.length" class="muted">Laba bersih: <span v-for="(l, i) in r.laba" :key="l[0]"><template v-if="i"> · </template>{{ l[0] }} <span :class="l[1] < 0 ? 'c-strong' : 'c-good'">{{ labaTxt(l[1]) }}</span></span></p>
                <button type="button" class="btn" @click="emit('analisa', r.t)">Analisa mendalam {{ r.t }}</button>
              </td></tr>
            </template>
          </tbody>
        </table>
      </div>

      <template v-if="d.pernah?.length">
        <h3 class="j">Pernah atau masih dipegang di luar data ≥1% terkini</h3>
        <p class="small muted">Dari berita dan pengakuan AH. Status: keluar dari ≥1% (namanya hilang dari daftar KSEI, porsi di bawah 1% tidak
          diungkap), pengakuan AH (bukan data KSEI), disebut media (belum terverifikasi data kepemilikan).</p>
        <div class="scroll">
          <table class="ledger small">
            <thead><tr><th>Saham</th><th>Status</th><th class="num">Saham beredar</th><th class="num">Publik</th><th class="num">Nilai float</th>
              <th class="num">Harga</th><th class="num">Pemegang ±3 bln</th><th class="num">Skor ciri</th><th></th></tr></thead>
            <tbody>
              <template v-for="r in d.pernah" :key="r.t">
                <tr>
                  <td><b>{{ r.t }}</b> <span v-if="r.suspen" class="tag t-strong">suspensi</span><span v-if="r.radar" class="tag t-warn">radar</span>
                    <div class="muted">{{ r.nama }}</div></td>
                  <td><span class="tag" :class="r.status === 'pengakuan AH' ? 't-now' : 't-calm'">{{ r.status }}</span></td>
                  <td class="num">{{ lembar(r.saham) }}</td>
                  <td class="num">{{ pctId(r.ff) }}</td>
                  <td class="num">{{ big(r.nilaiFloat) }}</td>
                  <td class="num">{{ r.harga ? fmt(r.harga, 0) : '–' }}</td>
                  <td class="num" :class="trenTeks(r.tren).nada">{{ trenTeks(r.tren).teks }}</td>
                  <td class="num"><span class="tag" :class="nadaSkor(r.skor)">{{ r.skor }}</span></td>
                  <td><button type="button" class="btn" :aria-expanded="String(buka === 'p' + r.t)" @click="togel('p' + r.t)">{{ buka === 'p' + r.t ? 'Tutup' : 'Detail' }}</button></td>
                </tr>
                <tr v-if="buka === 'p' + r.t" class="dalam"><td colspan="9">
                  <p>{{ r.ket }}<template v-for="s in r.sumber" :key="s.url"> · <a :href="s.url" target="_blank" rel="noopener">{{ s.judul }}</a> ({{ fmtDate(s.tanggal) }})</template></p>
                  <ul><li v-for="x in r.ringkas" :key="x">{{ x }}</li></ul>
                  <div v-if="r.notasi?.length" class="tk"><span v-for="n in r.notasi" :key="n.k" class="tag t-warn">notasi {{ n.k }}: {{ n.ket }}</span></div>
                  <p v-if="r.pemegang.length" class="muted">Pemegang ≥1%: {{ r.pemegang.map(p => `${p.nama} ${fmt(p.pct, 2)}%`).join(', ') }}</p>
                  <p v-if="r.laba.length" class="muted">Laba bersih: <span v-for="(l, i) in r.laba" :key="l[0]"><template v-if="i"> · </template>{{ l[0] }} <span :class="l[1] < 0 ? 'c-strong' : 'c-good'">{{ labaTxt(l[1]) }}</span></span></p>
                  <button type="button" class="btn" @click="emit('analisa', r.t)">Analisa mendalam {{ r.t }}</button>
                </td></tr>
              </template>
            </tbody>
          </table>
        </div>
      </template>

      <div class="dua">
        <div>
          <h4>Ciri saham pilihan AH (median)</h4>
          <ul class="small">
            <li>Saham beredar {{ lembar(d.ciri.saham) }}, porsi publik {{ pctId(d.ciri.ff) }}.</li>
            <li>Nilai float {{ big(d.ciri.nilaiFloat) }}, kapitalisasi {{ big(d.ciri.mcap) }}.</li>
            <li>Pola: barang beredar tipis sehingga sedikit modal sudah bisa menguasai porsi berarti dan menggerakkan harga.</li>
          </ul>
        </div>
        <div>
          <h4>Pemegang yang muncul bersama AH</h4>
          <ul v-if="d.rekan.length" class="small"><li v-for="x in d.rekan" :key="x.nama"><b>{{ x.nama }}</b> di {{ x.di.join(', ') }}</li></ul>
          <p v-else class="small muted">Belum ada.</p>
          <p class="small muted">Muncul bersama di daftar pemegang ≥1%, bukan bukti afiliasi.</p>
        </div>
      </div>

      <template v-if="reko.length">
        <h3 class="j">Rekomendasi 5 saham</h3>
        <p class="small muted">Dipilih otomatis dari screening di bawah: skor tertinggi yang jumlah pemegangnya menyusut ≥5% dalam ±3 bulan
          (tanda pengumpulan), status perdagangan sudah dicek, tanpa suspensi, notasi khusus, atau UMA.</p>
        <div class="reko">
          <div v-for="(r, i) in reko" :key="r.t" class="kartu">
            <div class="kp"><span class="no">{{ i + 1 }}</span> <b>{{ r.t }}</b>
              <span class="tag" :class="nadaSkor(r.skor)">skor {{ r.skor }}</span>
              <span v-if="r.radar" class="tag t-warn">radar</span><span v-if="r.jejak.length" class="tag t-now">rekan AH</span></div>
            <div class="muted small">{{ r.nama }}</div>
            <div class="small">{{ lembar(r.saham) }} · publik {{ pctId(r.ff) }} · float {{ big(r.nilaiFloat) }}</div>
            <div class="small">Pemegang ±3 bln <span :class="trenTeks(r.tren).nada">{{ trenTeks(r.tren).teks }}</span>
              <template v-if="r.harga"> · harga {{ fmt(r.harga, 0) }}</template></div>
            <div v-if="r.laba.length" class="small muted">Laba {{ r.laba.length }} kuartal: {{ r.laba.filter(l => l[1] < 0).length ? r.laba.filter(l => l[1] < 0).length + ' rugi' : 'semua positif' }}</div>
            <div class="kb"><button type="button" class="btn kecil0" @click="lihat(r.t)">Analisa</button>
              <button type="button" class="btn kecil0" @click="emit('analisa', r.t)">Analisa mendalam</button></div>
          </div>
        </div>
        <p class="small muted">Ciri serupa belum berarti AH akan masuk. Bukan rekomendasi beli/jual.</p>
      </template>

      <h3 class="j">Screening: saham berpotensi dengan ciri pilihan AH</h3>
      <p class="small muted">{{ d.dinilai }} emiten dinilai (Key Stats Stockbit seluruh kode BEI; ETF/reksa dana tidak ikut) · {{ d.rows.length }} lolos (skor ≥ 50, saham beredar ≤ 2 miliar, publik ≤ 40%) · saham yang disuspensi tidak ditampilkan · diperbarui {{ d.updated }}.
        Skor: saham beredar sedikit (30), porsi publik kecil (25), nilai float tipis (20), jumlah pemegang menyusut (10), ada pemegang yang juga muncul di saham AH (15).</p>
      <p v-if="d.belumDicek" class="small c-strong">Status suspensi {{ d.belumDicek }} saham belum dicek; server sedang melengkapinya, muat ulang beberapa menit lagi.</p>
      <div class="fl small">
        <input v-model="cari" type="search" placeholder="Cari kode/nama" aria-label="Cari saham di screening" />
        <label>Saham beredar <select v-model="maksSaham"><option :value="Infinity">semua</option><option :value="5e8">≤ 500 juta</option><option :value="1e9">≤ 1 miliar</option></select></label>
        <label>Publik <select v-model="maksFF"><option :value="Infinity">semua</option><option :value="15">≤ 15%</option><option :value="25">≤ 25%</option><option :value="30">≤ 30%</option></select></label>
        <label><input v-model="rekan" type="checkbox" /> ada pemegang bersama AH</label>
      </div>
      <div class="scroll">
        <table class="ledger small">
          <thead><tr><th>Saham</th><th class="num">Skor</th><th class="num">Saham beredar</th><th class="num">Publik</th><th class="num">Nilai float</th>
            <th class="num">Harga</th><th class="num">Pemegang ±3 bln</th><th></th></tr></thead>
          <tbody>
            <template v-for="r in rows" :key="r.t">
              <tr :id="'ah-' + r.t">
                <td><b>{{ r.t }}</b> <span v-if="r.radar" class="tag t-warn">radar</span><span v-if="r.jejak.length" class="tag t-now" :title="r.jejak.map(j => j.nama).join(', ')">rekan AH</span>
                  <span v-if="r.backdoor != null" class="tag" :class="r.backdoor >= 40 ? 't-warn' : 't-calm'" title="Skor potensi backdoor dari analisa mendalam terakhir">backdoor {{ r.backdoor }}</span>
                  <span v-for="n in r.notasi || []" :key="n.k" class="tag t-calm" :title="n.ket">{{ n.k }}</span>
                  <div class="muted">{{ r.nama }}</div></td>
                <td class="num"><span class="tag" :class="nadaSkor(r.skor)">{{ r.skor }}</span></td>
                <td class="num" :title="r.sahamKira ? 'Perkiraan: kapitalisasi dibagi harga' : null">{{ r.sahamKira ? '±' : '' }}{{ lembar(r.saham) }}</td>
                <td class="num">{{ pctId(r.ff) }}</td>
                <td class="num">{{ big(r.nilaiFloat) }}</td>
                <td class="num">{{ r.harga ? fmt(r.harga, 0) : '–' }}</td>
                <td class="num" :class="trenTeks(r.tren).nada">{{ trenTeks(r.tren).teks }}</td>
                <td><button type="button" class="btn" :aria-expanded="String(buka === r.t)" @click="togel(r.t)">{{ buka === r.t ? 'Tutup' : 'Analisa' }}</button></td>
              </tr>
              <tr v-if="buka === r.t" class="dalam"><td colspan="8">
                <p><b>Kenapa masuk:</b> {{ r.alasan.join('; ') }}.</p>
                <ul><li v-for="x in r.ringkas" :key="x">{{ x }}</li></ul>
                <div v-if="r.notasi?.length" class="tk"><span v-for="n in r.notasi" :key="n.k" class="tag t-warn">notasi {{ n.k }}: {{ n.ket }}</span></div>
                <p v-if="r.jejak.length">Pemegang yang juga muncul di saham AH: <span v-for="j in r.jejak" :key="j.nama"><b>{{ j.nama }}</b> {{ fmt(j.pct, 2) }}% (juga di {{ j.di.join(', ') }}) </span></p>
                <p v-if="r.pemegang.length" class="muted">Pemegang ≥1%: {{ r.pemegang.map(p => `${p.nama} ${fmt(p.pct, 2)}%`).join(', ') }}</p>
                <p v-if="r.tren?.seri?.length" class="muted">Jumlah pemegang: {{ r.tren.seri.slice().reverse().map(x => `${fmtDate(x[0])} ${fmt(x[1], 0)}`).join(' → ') }}</p>
                <p v-if="r.laba.length" class="muted">Laba bersih: <span v-for="(l, i) in r.laba" :key="l[0]"><template v-if="i"> · </template>{{ l[0] }} <span :class="l[1] < 0 ? 'c-strong' : 'c-good'">{{ labaTxt(l[1]) }}</span></span></p>
                <p class="muted">Ciri serupa belum berarti AH akan masuk. Cek tujuan pengendali, keterbukaan, dan likuiditas sebelum mengambil keputusan.</p>
                <button type="button" class="btn" @click="emit('analisa', r.t)">Analisa mendalam {{ r.t }}</button>
              </td></tr>
            </template>
          </tbody>
        </table>
      </div>
      <p v-if="!rows.length" class="small muted">Tidak ada saham yang cocok dengan saringan.</p>

      <template v-if="d.tanpaFF?.length">
        <h4>Saham beredar sedikit tanpa data free float</h4>
        <p class="small muted">Free float belum ada, jadi belum diberi skor penuh. Yang sedang disuspensi tidak dimasukkan.</p>
        <ul class="small"><li v-for="r in d.tanpaFF" :key="r.t"><b>{{ r.t }}</b> {{ lembar(r.saham) }}<template v-if="r.harga"> · harga {{ fmt(r.harga, 0) }}</template>
          <span class="muted"> · sumber: {{ r.asal }}</span>
          <template v-if="r.dicek === false"> · status perdagangan belum dicek</template>
          <button type="button" class="btn kecil" @click="emit('analisa', r.t)">Analisa mendalam</button></li></ul>
      </template>
      <p v-if="d.suspen?.length" class="small muted">Disaring keluar karena sedang disuspensi: {{ d.suspen.map(x => x.t).join(', ') }}.</p>
      <p class="small muted">{{ d.profil.catatan }} Bukan rekomendasi beli/jual.</p>
    </template>
  </div>
</template>

<style scoped>
.ah{display:flex;flex-direction:column;gap:8px}
.ket{margin:0;color:var(--ink-2);max-width:110ch;line-height:1.55}
.j{margin:10px 0 2px;font-size:15px}
h4{margin:6px 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.num{text-align:right;white-space:nowrap}
.dalam td{background:var(--sheet-2)}
.dalam ul{margin:4px 0;padding-left:18px}
.dalam p{margin:4px 0}
.jl{list-style:none;padding-left:0 !important}
.tk{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0}
.akumulasi{color:var(--good)}.distribusi{color:var(--strong)}
.dua{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.dua ul{margin:0;padding-left:18px}
.fl{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.fl input[type=search],.fl select{padding:5px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:inherit;font:inherit}
.kecil{padding:1px 8px;margin-left:6px}
.c-strong{color:var(--strong)}.c-good{color:var(--good)}
.reko{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.kartu{border:1px solid var(--rule);border-radius:8px;padding:8px 10px;background:var(--sheet);display:flex;flex-direction:column;gap:3px}
.kp{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.no{color:var(--ink-2);font-size:12px}
.kb{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap}
.kecil0{padding:1px 8px}
</style>
