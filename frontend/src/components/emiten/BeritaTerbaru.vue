<script setup>
// Analisa otomatis laporan/berita TERBARU emiten ini (lib/beritaTerbaru.js), lengkap dengan unduhan PDF berformat
// riset Seasonality. Diperbarui sendiri setiap sinkron berita server (tiap 2 jam); hanya dokumen terakhir yang dianalisa.
import { computed, ref } from 'vue'
import { store } from '../../store.js'
import { fmtDate } from '../../lib/domain.js'
import { beritaTerakhir, analisaBerita } from '../../lib/beritaTerbaru.js'

// daftar: berita saham di luar radar (diambil saat dicari); bila kosong memakai feed radar (store.updates).
// u: laporan tertentu yang dianalisa (daftar Stockbit Reports); tanpa u = dokumen terbaru. judul: label bagian.
const props = defineProps({ ticker: { type: String, required: true }, daftar: { type: Array, default: null },
  u: { type: Object, default: null }, judul: { type: String, default: 'Analisa berita terbaru' } })
const sumber = computed(() => props.daftar || store.updates)
const a = computed(() => analisaBerita(props.u || beritaTerakhir(sumber.value, props.ticker), {
  items: store.items, pandangan: store.pandangan, updates: sumber.value, pengendali: store.pengendali, relasi: store.relasi, verified: store.verified,
}))
const busy = ref(false), err = ref('')
// Tanpa u (analisa dokumen terbaru di tab Berita): tampil satu baris seperti daftar Stockbit Reports; isi analisa
// muncul setelah tombol Analisa diklik. Dengan u (dibuka dari daftar laporan): langsung tampil lengkap.
const buka = ref(!!props.u)
async function unduh() {
  busy.value = true; err.value = ''
  try {
    const [{ jsPDF }, mod] = await Promise.all([import('jspdf'), import('../../lib/beritaPdf.js')])
    ;(await mod.beritaPdf(a.value, jsPDF)).save(mod.beritaPdfName(a.value))
  } catch (e) {
    err.value = 'PDF gagal dibuat: ' + (e.message || e)
  } finally {
    busy.value = false
  }
}
// Kelas tag global: t-good / t-warn / t-calm / t-strong (tidak ada t-bad).
const tag = c => 't-' + (c === 'bad' ? 'strong' : c)
const KYK = { Tinggi: 't-good', Sedang: 't-warn', Rendah: 't-calm' }
const NILAI = { Didukung: 't-good', 'Sebagian didukung': 't-warn', 'Belum didukung': 't-calm' }
</script>

<template>
  <section v-if="a" class="bt rule-top">
    <div v-if="!u" class="hd">
      <h2 class="lbl">{{ judul }}</h2>
      <span class="small muted">{{ a.laporan ? 'Keterbukaan resmi' : 'Berita media' }} · {{ a.jenis }}</span>
    </div>
    <div v-if="!u" class="baris" :class="{ on: buka }">
      <span class="d">{{ fmtDate(a.tanggal) }}</span>
      <a v-if="a.url" :href="a.url" target="_blank" rel="noopener" class="lt">{{ a.judul }}</a><span v-else class="lt">{{ a.judul }}</span>
      <span class="tags"><span class="tag" :class="tag(a.sinyal.cls)">{{ a.sinyal.label }}</span>
        <span class="tag" :class="tag(a.dampak.cls)">Dampak: {{ a.dampak.label }}</span></span>
      <span class="act">
        <button type="button" class="pill sm" :aria-expanded="String(buka)" @click="buka = !buka">{{ buka ? 'Tutup' : 'Analisa' }}</button>
        <button type="button" class="pill sm" :disabled="busy" @click="unduh">{{ busy ? 'Menyiapkan…' : 'Unduh PDF' }}</button>
      </span>
    </div>
    <div v-else class="hd">
      <h2 class="lbl">{{ judul }}</h2>
      <span class="small muted">{{ a.laporan ? 'Keterbukaan resmi' : 'Berita media' }} · {{ fmtDate(a.tanggal) }} · {{ a.jenis }}</span>
      <button type="button" class="btn" :disabled="busy" @click="unduh">{{ busy ? 'Menyiapkan PDF…' : '⬇ Unduh analisa (PDF)' }}</button>
    </div>
    <p v-if="err" class="small c-strong">{{ err }}</p>

    <template v-if="buka">

    <div class="top" :class="'k-' + a.dampak.cls">
      <div class="row">
        <a v-if="a.url" :href="a.url" target="_blank" rel="noopener"><b class="ttl">{{ a.judul }}</b></a><b v-else class="ttl">{{ a.judul }}</b>
        <span class="tag" :class="tag(a.sinyal.cls)">{{ a.sinyal.label }}</span>
        <span class="tag" :class="tag(a.dampak.cls)">Dampak bagi publik: {{ a.dampak.label }}</span>
      </div>
      <p class="small">{{ a.kesimpulan }}</p>
    </div>

    <!-- Penyelidikan tujuan: kesimpulan dulu, lalu temuan (Cari tahu) dan uji dugaan (Selidiki) yang mendasarinya. -->
    <div class="card tj">
      <h3>Tujuannya apa? <span class="tag" :class="KYK[a.tujuan.keyakinan]">Keyakinan {{ a.tujuan.keyakinan.toLowerCase() }}</span></h3>
      <p class="utama">{{ a.tujuan.utama }}</p>
      <p v-if="a.tujuan.alasan" class="small">{{ a.tujuan.alasan }}</p>
      <p v-if="a.tujuan.alternatif.length" class="small muted">Kemungkinan lain: {{ a.tujuan.alternatif.join('; ') }}.</p>
    </div>
    <div class="grid tri">
      <div class="card">
        <h3>Cari tahu: temuan</h3>
        <ul class="nd"><li v-for="x in a.cari" :key="x.sumber + x.teks"><span class="src">{{ x.sumber }}</span> {{ x.teks }}</li></ul>
      </div>
      <div class="card">
        <h3>Selidiki: uji dugaan tujuan</h3>
        <div v-for="d in a.selidiki" :key="d.dugaan" class="dg">
          <p class="small"><b>{{ d.dugaan }}</b> <span class="tag" :class="NILAI[d.nilai]">{{ d.nilai }}</span></p>
          <ul class="nd small"><li v-for="b in d.bukti" :key="b.teks"><span :class="b.arah > 0 ? 'c-good' : b.arah < 0 ? 'c-strong' : 'muted'">{{ b.arah > 0 ? '▲' : b.arah < 0 ? '▼' : '●' }}</span> {{ b.teks }}</li></ul>
        </div>
        <p v-if="!a.selidiki.length" class="small muted">Belum ada bukti yang cukup untuk menguji dugaan tujuan.</p>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Isi dokumen</h3>
        <p v-if="a.ringkas" class="small">{{ a.ringkas }}</p>
        <ul v-if="a.poin.length"><li v-for="p in a.poin" :key="p">{{ p }}</li></ul>
      </div>
      <div class="card">
        <h3>Dampak bagi pemegang saham publik</h3>
        <p class="small muted">{{ a.sinyal.why }}</p>
        <p v-if="a.dampak.catatan" class="small muted">{{ a.dampak.catatan }}</p>
        <template v-else>
          <h3 class="sub c-good">Dampak positif</h3>
          <ul class="nd"><li v-for="x in a.dampak.positif" :key="x"><span class="c-good">▲</span> {{ x }}</li>
            <li v-if="!a.dampak.positif.length" class="muted">Tidak teridentifikasi dari isi dokumen.</li></ul>
          <h3 class="sub c-strong">Dampak negatif / risiko</h3>
          <ul class="nd"><li v-for="x in a.dampak.negatif" :key="x"><span class="c-strong">▼</span> {{ x }}</li>
            <li v-if="!a.dampak.negatif.length" class="muted">Tidak teridentifikasi dari isi dokumen.</li></ul>
        </template>
      </div>
      <div class="card">
        <template v-if="a.implikasi.length"><h3>Implikasi</h3><ul><li v-for="x in a.implikasi" :key="x">{{ x }}</li></ul></template>
        <h3 class="sub">Kaitan dengan tesis</h3>
        <template v-if="a.tesis">
          <p class="small"><b>{{ a.tesis.sikap }}</b> · analisa per {{ fmtDate(a.tesis.asOf) }}</p>
          <p class="small">{{ a.tesis.ringkas }}</p>
          <p v-if="a.tesis.posisi" class="small muted">{{ a.tesis.posisi }}</p>
        </template>
        <p v-else class="small muted">{{ ticker }} belum memiliki analisa kurasi; dampak dinilai hanya dari isi dokumen.</p>
        <template v-if="a.fakta.length"><h3 class="sub">Fakta aset dan transaksi</h3><ul><li v-for="f in a.fakta" :key="f">{{ f }}</li></ul></template>
      </div>
      <div class="card">
        <h3>Yang dipantau</h3>
        <ul v-if="a.pantau.length"><li v-for="p in a.pantau" :key="p">{{ p }}</li></ul>
        <p v-else class="small muted">Keterbukaan berikutnya dari emiten.</p>
        <template v-if="a.riwayat.length"><h3 class="sub">Keterbukaan sebelumnya (90 hari)</h3>
          <ul class="small"><li v-for="x in a.riwayat" :key="x.tanggal + x.judul">{{ fmtDate(x.tanggal) }}: {{ x.judul }}</li></ul></template>
        <template v-if="a.salahBila.length"><h3 class="sub">Tesis salah bila</h3><ul><li v-for="p in a.salahBila" :key="p">{{ p }}</li></ul></template>
      </div>
    </div>
    <p class="small muted">Dibaca otomatis dari judul, ringkasan, dan poin kunci dokumen terakhir; diperbarui setiap sinkron berita. ▲ positif bagi pemegang saham publik, ▼ negatif atau risiko.</p>
    </template>
  </section>
</template>

<style scoped>
.baris{display:grid;grid-template-columns:90px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--rule-2)}
.baris.on{background:var(--zebra)}
.baris .d{font:600 13px var(--f-display);color:var(--ink-2)}.baris .lt{color:var(--ink);font-size:14px}
.baris .tags{display:flex;gap:4px;flex-wrap:wrap}.baris .act{display:flex;gap:4px}
@media (max-width:760px){.baris{grid-template-columns:80px minmax(0,1fr)}.baris .tags,.baris .act{grid-column:2}}
.hd{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;margin-bottom:8px}.hd .btn{margin-left:auto}.lbl{margin:0}
.top{border:1px solid var(--rule);border-left-width:4px;padding:10px 12px;background:var(--sheet);margin-bottom:10px}
.top.k-good{border-left-color:var(--good)}.top.k-bad{border-left-color:var(--strong)}.top.k-calm{border-left-color:var(--ink-2)}
.row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}.ttl{font-size:15px}.top p{margin:6px 0 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
.grid.tri{margin-bottom:10px}
.tj{margin-bottom:10px;border-left:4px solid var(--now-ink)}.tj .utama{font-weight:600;margin:4px 0}.tj p{margin:4px 0}
.src{display:inline-block;font-size:11px;padding:0 6px;border:1px solid var(--rule);border-radius:9px;color:var(--ink-2);margin-right:4px}
.dg{padding:4px 0;border-top:1px solid var(--rule)}.dg:first-of-type{border-top:0}.dg p{margin:2px 0}
.card{border:1px solid var(--rule);padding:10px 12px;background:var(--sheet)}
.card h3{font-size:12px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 6px}.card h3.sub{margin-top:10px}
.card ul{margin:0;padding-left:18px}.card li{margin:2px 0}.nd{list-style:none;padding-left:0 !important}
</style>
