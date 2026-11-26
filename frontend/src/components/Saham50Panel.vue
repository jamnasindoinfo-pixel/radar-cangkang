<script setup>
// Saham 50: saham berharga <= Rp50 di seluruh BEI dengan analisa potensi ke depan (/api/saham50): radar backdoor &
// calon cangkang, aksi korporasi 90-180 hari, kinerja laporan keuangan & kuartal murni, valuasi, dan teknikal harga.
// Skor 0-100 dan narasi disusun server; daftar diperbarui harian setelah bursa tutup. Dapat diunduh sebagai PDF.
import { computed, reactive, ref } from 'vue'
import { api } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'
import { isHsc } from '../lib/hsc.js'

const data = ref(null), err = ref(''), loading = ref(true)
api.get('/api/saham50').then(r => { if (r.error) err.value = r.error; else data.value = r }, e => { err.value = e.message || String(e) }).finally(() => { loading.value = false })

const KAT = [['semua', 'Semua'], ['backdoor', 'Backdoor / calon cangkang'], ['aksi', 'Aksi korporasi 90 hari'], ['kinerja', 'Kinerja membaik'], ['q3', 'Q3 naik (YoY & QoQ)'], ['akum', 'Akumulasi broker'], ['skorNaik', 'Skor naik'], ['murah', 'PBV < 1']]
const f = reactive({ kat: 'semua', cari: '', tanpaDatar: true })
// Kriteria tiap kategori (dipakai saringan dan penghitung).
const KRIT = {
  semua: () => true,
  backdoor: x => x.radar || x.kandidat,
  aksi: x => x.jenisAksi.some(j => j !== 'uma'),
  // Kuartal murni naik dari tahun lalu dan dari kuartal sebelumnya (server lk_tumbuh), atau laporan kumulatif bagus.
  kinerja: x => !!x.kinerja?.kuartal?.tumbuh || ['bagus', 'berbalik'].includes(x.kinerja?.kategori),
  // Sama dengan tab Kinerja: laba kuartal murni > kuartal sama tahun lalu DAN > kuartal sebelumnya.
  q3: x => !!x.kinerja?.kuartal?.tumbuh,
  akum: x => (x.broker?.at(-1)?.bandar ?? 0) > 0,
  skorNaik: x => x.skorLalu != null && x.skor > x.skorLalu,
  murah: x => x.valuasi?.pbv > 0 && x.valuasi.pbv < 1,
}
// Perubahan skor dibanding catatan >= 7 hari lalu (server: riwayat skor harian).
const dSkor = x => x.skorLalu == null ? null : x.skor - x.skorLalu
// Nilai rupiah ringkas untuk net broker.
const rpRingkas = v => { const a = Math.abs(v); return (v < 0 ? '−' : '+') + 'Rp' + (a >= 1e9 ? fmt(a / 1e9, 1) + ' M' : a >= 1e6 ? fmt(a / 1e6, 0) + ' jt' : fmt(a, 0)) }
const qTeks = k => !k ? '' : `Q${k.q} ` + (k.tumbuh ? (k.status === 'berbalik' ? 'berbalik laba, > Q sebelumnya' : 'naik YoY & QoQ')
  : ({ naik: 'naik YoY, < Q sebelumnya', berbalik: 'berbalik laba, < Q sebelumnya', turun: 'turun', rugi: 'rugi' }[k.status] || '–'))
const rows = computed(() => {
  const q = f.cari.trim().toUpperCase()
  return (data.value?.rows || []).filter(x => KRIT[f.kat](x) && (!f.tanpaDatar || !x.tek.datar) && (!q || x.t.includes(q) || (x.nama || '').toUpperCase().includes(q)))
})
const hitung = computed(() => Object.fromEntries(KAT.map(([k]) => [k, (data.value?.rows || []).filter(KRIT[k]).length])))
const n = ref(60), buka = ref('')
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 1) + '%'
const JENIS = { akuisisi: 'Pengendali', rights: 'Modal', kbli: 'Usaha baru', direksi: 'Pengurus', uma: 'UMA' }

const busyPdf = ref(false), errPdf = ref('')
async function unduhPdf() {
  busyPdf.value = true; errPdf.value = ''
  try {
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../lib/daftarPdf.js')])
    const label = KAT.find(k => k[0] === f.kat)[1]
    const spec = { seri: 'Riset Saham 50', judul: 'Saham 50: Harga Rp50 ke Bawah', label: label.toUpperCase(),
      sub: 'Saham berharga Rp50 ke bawah di seluruh BEI dengan analisa potensi: backdoor, aksi korporasi, kinerja, valuasi, dan teknikal.',
      updated: data.value.updated, box: [['Saham <= Rp50', String(data.value.n)], ['Backdoor/kandidat', String(hitung.value.backdoor)], ['Aksi korporasi', String(hitung.value.aksi)], ['Kinerja membaik', String(hitung.value.kinerja)]],
      bagian: [{ judul: `Saham 50 · ${label}`, ket: 'Skor 0-100: radar/calon cangkang, aksi korporasi, kinerja, valuasi, teknikal. Target = nilai wajar analisa radar atau resistance terdekat.',
        cols: [{ t: 'Saham', w: 15 }, { t: 'Skor', w: 11, align: 'right' }, { t: 'Harga', w: 14, align: 'right' }, { t: 'Target', w: 22, align: 'right' }, { t: 'Potensi / risiko', w: 120 }],
        rows: rows.value.slice(0, 150).map(x => [{ t: x.t, bold: true }, String(x.skor), P.n0(x.harga),
          x.target ? `${P.n0(x.target.harga)} (${pct(x.target.potensi)})` : '-', [...x.potensi, ...x.risiko.map(r => 'Risiko: ' + r)].join('. ')]) }],
      metode: 'Penyaringan otomatis dari harga Stockbit, keterbukaan informasi, laporan keuangan, dan Key Stats; bukan ajakan membeli. Saham di bawah Rp50 umumnya likuiditasnya tipis.' }
    ;(await P.daftarPdf(spec, jsPDF)).save(P.daftarPdfName('Saham-50'))
  } catch (e) { errPdf.value = 'PDF gagal dibuat: ' + (e.message || e) } finally { busyPdf.value = false }
}
</script>

<template>
  <section class="s50">
    <p class="small muted intro">Saham berharga <b>Rp50 ke bawah</b> di seluruh BEI beserta analisa potensinya: radar backdoor dan calon cangkang,
      aksi korporasi, kinerja laporan keuangan, valuasi, dan teknikal. Diperbarui otomatis setiap hari setelah bursa tutup.</p>
    <div class="unduh"><span v-if="errPdf" class="small c-strong">{{ errPdf }}</span>
      <button type="button" class="btn" :disabled="busyPdf || !data" @click="unduhPdf">{{ busyPdf ? 'Menyiapkan PDF…' : '⬇ Unduh riset Saham 50 (PDF)' }}</button></div>
    <p v-if="loading" class="muted">Memuat Saham 50…</p>
    <p v-else-if="err" class="muted">{{ err }}</p>
    <template v-else-if="data">

      <div class="kat" role="tablist" aria-label="Kategori Saham 50">
        <button v-for="[k, l] in KAT" :key="k" type="button" role="tab" class="pill" :aria-selected="String(f.kat === k)" :aria-pressed="String(f.kat === k)" @click="f.kat = k; n = 60; buka = ''">
          {{ l }} <span class="muted">{{ hitung[k] }}</span></button>
      </div>
      <div class="flt">
        <input v-model="f.cari" type="search" class="cari" placeholder="Cari kode atau nama…" aria-label="Cari saham" />
        <button type="button" class="pill sm" :aria-pressed="String(f.tanpaDatar)" title="Sembunyikan saham yang harganya hampir tidak bergerak 20 hari" @click="f.tanpaDatar = !f.tanpaDatar">Sembunyikan yang tidak likuid</button>
      </div>
      <div class="mh"><h2>Daftar Saham 50</h2><span class="small muted">{{ rows.length }} dari {{ data.n }} saham ≤ Rp{{ data.batas }} · diperbarui {{ data.updated }}</span></div>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th>Saham</th><th class="num">Skor</th><th class="num" title="Perubahan skor dibanding minggu lalu">Δ skor</th><th class="num">Harga</th><th class="num">1M</th><th class="num">YTD</th><th class="num">Dari terendah</th>
            <th class="num">PBV</th><th>Aksi korporasi</th><th>Kinerja</th><th>Broker 30 hari</th><th class="num">Target</th></tr></thead>
          <tbody>
            <template v-for="x in rows.slice(0, n)" :key="x.t">
              <tr class="row" :class="{ open: buka === x.t }" tabindex="0" @click="buka = buka === x.t ? '' : x.t" @keydown.enter="buka = buka === x.t ? '' : x.t">
                <td><span class="car">{{ buka === x.t ? '▾' : '▸' }}</span>
                  <RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }" @click.stop><b>{{ x.t }}</b></RouterLink>
                  <span v-if="x.radar" class="tag t-warn">backdoor</span><span v-else-if="x.kandidat" class="tag t-calm">kandidat</span>
                  <span v-if="isHsc(x.t)" class="tag t-warn">HSC</span>
                  <div v-if="x.nama" class="small muted nm">{{ x.nama }}</div></td>
                <td class="num"><b>{{ x.skor }}</b></td>
                <td class="num small" :class="dSkor(x) > 0 ? 'c-good' : dSkor(x) < 0 ? 'c-strong' : 'muted'" :title="x.skorTgl ? 'Skor ' + x.skorLalu + ' pada ' + fmtDate(x.skorTgl) : 'Belum ada riwayat'">{{ dSkor(x) == null ? '–' : (dSkor(x) > 0 ? '▲' + dSkor(x) : dSkor(x) < 0 ? '▼' + -dSkor(x) : '0') }}</td>
                <td class="num">Rp{{ fmt(x.harga, 0) }}</td>
                <td class="num" :class="(x.tek.ret['1M'] ?? 0) >= 0 ? 'c-good' : 'c-strong'">{{ pct(x.tek.ret['1M']) }}</td>
                <td class="num" :class="(x.tek.ret.YTD ?? 0) >= 0 ? 'c-good' : 'c-strong'">{{ pct(x.tek.ret.YTD) }}</td>
                <td class="num small">{{ pct(x.tek.dariRendah) }}</td>
                <td class="num small">{{ x.valuasi?.pbv != null ? fmt(x.valuasi.pbv, 2) + '×' : '–' }}</td>
                <td class="small"><span v-for="j in x.jenisAksi" :key="j" class="tag" :class="j === 'uma' ? 't-strong' : 't-calm'">{{ JENIS[j] || j }}</span><span v-if="!x.jenisAksi.length" class="muted">–</span></td>
                <td class="small" :class="x.kinerja?.kuartal?.tumbuh ? 'c-good' : ''">{{ x.kinerja?.kuartal ? qTeks(x.kinerja.kuartal) : (x.kinerja?.judul || '–') }}</td>
                <td class="small"><template v-if="x.broker?.length"><span :class="x.broker.at(-1).bandar > 0 ? 'c-good' : 'c-strong'">{{ x.broker.at(-1).bandar > 0 ? 'Akumulasi' : 'Distribusi' }} {{ rpRingkas(x.broker.at(-1).bandar) }}</span>
                  <div class="muted">{{ x.broker.at(-1).label }} · {{ (x.broker.at(-1).bandar > 0 ? x.broker.at(-1).akum : x.broker.at(-1).dist).join(', ') }}</div></template><span v-else class="muted">–</span></td>
                <td class="num small">{{ x.target ? 'Rp' + fmt(x.target.harga, 0) + ' (' + pct(x.target.potensi) + ')' : '–' }}</td>
              </tr>
              <tr v-if="buka === x.t" class="det"><td colspan="12">
                <div class="dua">
                  <div><b class="small">Potensi ke depan</b><ul class="small"><li v-for="p in x.potensi" :key="p">{{ p }}</li><li v-if="!x.potensi.length" class="muted">Belum ada katalis yang terbaca.</li></ul></div>
                  <div><b class="small">Risiko</b><ul class="small"><li v-for="r in x.risiko" :key="r">{{ r }}</li><li v-if="!x.risiko.length" class="muted">Tidak ada catatan risiko khusus.</li></ul></div>
                </div>
                <p v-if="x.target" class="small muted">Target {{ x.target.dasar }}: Rp{{ fmt(x.target.harga, 0) }} ({{ pct(x.target.potensi) }}).
                  Teknikal: RSI {{ x.tek.rsi ?? '–' }}, {{ x.tek.diAtasEma20 ? 'di atas' : 'di bawah' }} EMA20, {{ pct(x.tek.dariTinggi) }} dari tertinggi 52 minggu.</p>
                <p v-if="x.broker?.length" class="small"><b>Pola broker</b> (net 3 pembeli + 3 penjual teratas):
                  <template v-for="(b, i) in x.broker" :key="b.label"><span v-if="i"> · </span>{{ b.label }} {{ rpRingkas(b.bandar) }}
                    (akumulasi {{ b.akum.join(', ') || '–' }}; distribusi {{ b.dist.join(', ') || '–' }})</template></p>
                <p v-if="x.skorTgl" class="small muted">Skor {{ x.skorLalu }} pada {{ fmtDate(x.skorTgl) }} → {{ x.skor }} sekarang.</p>
                <template v-if="x.aksi.length"><b class="small">Keterbukaan aksi korporasi terbaru</b>
                  <ul class="small"><li v-for="a in x.aksi" :key="a.url + a.judul">{{ fmtDate(a.tgl) }} · <a :href="a.url" target="_blank" rel="noopener" @click.stop>{{ a.judul }}</a><span v-if="a.inti" class="muted"> — {{ a.inti }}</span></li></ul></template>
              </td></tr>
            </template>
          </tbody>
        </table>
      </div>
      <p v-if="rows.length > n" class="small"><button type="button" class="pill sm" @click="n += 60">Tampilkan 60 lagi ({{ rows.length - n }} tersisa)</button></p>
      <p class="small muted"><b>Skor potensi</b> (0–100): radar backdoor 25 atau calon cangkang 20, aksi pengendali 90 hari 15, penambahan modal/usaha baru 10,
        laba kuartal murni naik dari tahun lalu dan dari kuartal sebelumnya 15 (hanya dari tahun lalu 8), PBV &lt; 0,5× 10 (&lt; 1× 5), teknikal mulai naik 10 (dekat dasar 5). <b>Target</b> = batas atas nilai wajar
        analisa radar bila ada, selain itu resistance terdekat (tertinggi 60 hari). <b>Δ skor</b> = perubahan dibanding minggu lalu;
        <b>Broker</b> = net 3 broker pembeli + 3 penjual teratas 30 hari terakhir (cadangan: data Pola Broker bulanan). Saham di bawah Rp50 umumnya berlikuiditas tipis dan diperdagangkan
        di Papan Pemantauan Khusus; bukan ajakan membeli.</p>
    </template>
  </section>
</template>

<style scoped>
.intro{margin:0 0 6px}.unduh{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin:0 0 8px}
.kat,.flt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}
.cari{padding:5px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:inherit;min-width:180px}
.mh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mh h2{margin:8px 0 6px}
.scroll{overflow-x:auto}.row{cursor:pointer}.car{color:var(--ink-2);font-size:11px}.nm{max-width:200px}
.det td{background:var(--sheet)}.dua{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}.det ul{margin:4px 0;padding-left:18px}
</style>
