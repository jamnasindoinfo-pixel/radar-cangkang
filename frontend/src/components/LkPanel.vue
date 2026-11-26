<script setup>
// LK Bagus: laporan keuangan terbaru SELURUH emiten BEI dari akun StockbitReports (/api/lk), satu laporan terakhir per
// kode. Kategori dari ringkasan AI Stockbit: laba naik >= 20% (Bagus), berbalik laba, naik tipis, turun, rugi.
// Catatan kualitas (pendapatan, margin kotor, basis rendah) dihitung server dari angka laporan. Dapat diunduh sebagai PDF.
import { computed, reactive, ref } from 'vue'
import { api } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'
import { HSC_OPSI, isHsc, lolosHsc, hscInfo } from '../lib/hsc.js'
import HargaSaham from './HargaSaham.vue'
import { musimLk } from '../lib/musimLk.js'
import { grupKonglo, komoditas, terbaikPerKelompok, lolosPerSektor, SEKTOR, SEMUA } from '../lib/kelompokLk.js'

const data = ref(null), err = ref(''), loading = ref(true)
api.get('/api/lk').then(r => { if (r.error) err.value = r.error; else data.value = r }, e => { err.value = e.message || String(e) }).finally(() => { loading.value = false })

const KAT = [['bagus', 'Laba naik ≥ 20%'], ['berbalik', 'Berbalik laba'], ['naik', 'Naik < 20%'], ['turun', 'Laba turun'], ['rugi', 'Rugi'], ['semua', 'Semua']]
const kat = ref('bagus')
// Fokus periode otomatis menurut musim laporan (lib/musimLk.js): Okt-Des Q3 (9M), Jan-Mar Q4 (FY), dst.
const M = musimLk(), Q = `Q${M.q}`, KUM = M.kode.slice(0, 2)
const PERIODE = [['musim', M.judul], ['semua', 'Semua periode']]
const per = ref('musim')
const lolosPer = x => per.value === 'semua' || M.pola.includes(x.periode || '')
const basis = computed(() => (data.value?.rows || []).filter(lolosPer))
const hitung = computed(() => basis.value.reduce((h, x) => ({ ...h, [x.kategori]: (h[x.kategori] || 0) + 1 }), {}))
const f = reactive({ cari: '', hsc: '', radar: false, sehat: false, urut: 'laba', q3: '' })
// Kuartal III murni (server: 9M - 1H): saringan agar kenaikan 9M yang hanya ditopang Q1-Q2 terlihat.
const KUARTAL_SBLM = M.q > 1 ? `Q${M.q - 1}` : 'Q4'
const Q3OPSI = [['', 'Semua'], ['naik', `${Q} naik dari tahun lalu & ${KUARTAL_SBLM}`], ['melemah', `${Q} melemah`], ['tanpa', `${Q} belum terhitung`]]
const lolosQ3 = x => !f.q3 || (f.q3 === 'naik' ? !!x.kuartal?.tumbuh
  : f.q3 === 'melemah' ? x.kuartal?.melemah : !x.kuartal)
const URUT = [['laba', 'Kenaikan laba'], ['q3', `Laba ${Q} YoY`], ['nilai', 'Nilai laba'], ['pendapatan', 'Kenaikan pendapatan'], ['tgl', 'Terbaru']]
// Rupiah-setara untuk mengurutkan nilai laba (USD dikali kurs kasar agar urutan masuk akal).
const rpSetara = n => n ? n.v * (n.mata === 'USD' ? 16500 : 1) : 0
const rows = computed(() => {
  const q = f.cari.trim().toUpperCase()
  const r = basis.value.filter(x => (kat.value === 'semua' || x.kategori === kat.value)
    && lolosHsc(x.t, f.hsc) && (!f.radar || x.radar) && lolosQ3(x)
    && (!f.sehat || ((x.pendapatan?.pct ?? -1) > 0 && !x.catatan.some(c => /basis tahun lalu kecil|pendapatan turun/i.test(c))))
    && (!q || x.t.includes(q) || (x.nama || '').toUpperCase().includes(q)))
  const k = { laba: x => x.laba?.pct ?? -1e9, q3: x => x.kuartal?.yoy ?? (x.kuartal?.status === 'berbalik' ? 1e9 : -1e9), nilai: x => rpSetara(x.laba?.ke), pendapatan: x => x.pendapatan?.pct ?? -1e9, tgl: x => x.tgl }[f.urut]
  return [...r].sort((a, b) => (k(b) > k(a) ? 1 : k(b) < k(a) ? -1 : 0))
})
const n = ref(100)
const uang = x => {
  if (!x) return '–'
  const a = Math.abs(x.v), [d, s] = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'M'] : a >= 1e6 ? [1e6, 'jt'] : [1e3, 'rb']
  return `${x.mata === 'USD' ? 'US$' : 'Rp'}${fmt(x.v / d, 2)} ${s}`
}
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 1) + '%'
const uangQ = (v, m) => v == null ? '–' : uang({ v, mata: m })
const Q3TXT = { naik: 'c-good', berbalik: 'c-good', turun: 'c-strong', rugi: 'c-strong' }
const q3Pct = k => !k ? '–' : k.status === 'berbalik' ? 'berbalik laba' : k.status === 'rugi' ? 'rugi' : pct(k.yoy)
const hitQ3 = computed(() => ({ melemah: basis.value.filter(x => x.kuartal?.melemah).length, ada: basis.value.filter(x => x.kuartal).length }))
const labaPct = x => x.kategori === 'berbalik' ? 'berbalik' : x.laba?.pct == null ? '–' : (x.laba.arah === 'turun' ? '−' : '+') + fmt(x.laba.pct, 1) + '%'
const nada = x => ['bagus', 'berbalik', 'naik'].includes(x.kategori) ? 'c-good' : x.kategori === 'lain' ? 'muted' : 'c-strong'
const buka = ref('')

// Terbaik per kelompok (lib/kelompokLk.js: Konglo, CPO, Backdoor, Tambang batu bara/emas/nikel, Telekomunikasi & kabel;
// tanpa bank/asuransi) dari seluruh laporan periode terpilih, hanya dengan syarat yang bisa dicek di laporan (tanpa target harga):
// laba kuartal murni lebih besar dari kuartal yang sama tahun lalu (naik/berbalik YoY) DAN dari kuartal sebelumnya
// (QoQ > 0), pendapatan naik, PE TTM positif. Basis dinilai dari laba kuartal itu sendiri, bukan kumulatif, sehingga
// kenaikan kumulatif persentase besar dari basis kecil tetap bisa masuk bila kuartal terakhirnya memang tumbuh.
// Diurutkan dari PE TTM terendah (paling murah terhadap laba yang sudah terbukti).
// Server (lk_tumbuh): tumbuh = laba kuartal murni > kuartal sama tahun lalu DAN > kuartal sebelumnya (termasuk
// berbalik dari rugi); dipakai juga saringan "ikut naik" dan skor Saham 50.
const qoqTeks = k => k?.berbalikQoq ? 'berbalik dari rugi' : pct(k?.qoq)
// Syarat yang tidak terpenuhi (kosong = lolos); dipakai juga untuk menjelaskan kandidat terdekat yang belum lolos.
const GAGAL = x => {
  const k = x.kuartal, g = []
  if (!k) return [`laba ${Q} murni belum terhitung`]
  if ((k.laba ?? 0) <= 0 || !['naik', 'berbalik'].includes(k.status)) g.push(`${Q} tidak lebih besar dari tahun lalu`)
  if (k.naikQoq === false) g.push(`${Q} di bawah kuartal sebelumnya (${qoqTeks(k)})`)
  if (!((x.pendapatan?.pct ?? -1) > 0)) g.push(`pendapatan ${x.pendapatan ? pct(x.pendapatan.pct) : 'tidak tersedia'}`)
  if (!(k.pe > 0)) g.push('PE TTM negatif (rugi 12 bulan)')
  return g
}
// Kartu: p = pilihan (yang lolos; bila tidak ada, kandidat terdekat dengan peringatan syarat yang belum terpenuhi).
const kelompok = computed(() => terbaikPerKelompok(basis.value, GAGAL).map(g => {
  const d0 = g.x ? null : g.dekat[0]
  return { ...g, p: g.x || d0?.r || null, gagal: d0?.g || [], dekat: d0 ? g.dekat.slice(1) : g.dekat }
}))

// Terbaik per sektor IDX-IC (kategori sama dengan stockbit.com/sector, dari profil emiten x.kelas.sektor):
// syarat sama dengan kartu kelompok (GAGAL kosong), tanpa bank & asuransi, urut PE TTM terendah.
// "Semua" menggabungkan seluruh sektor; tampil 10 dulu, sisanya lewat tombol.
const sektor = ref(SEMUA), nSektor = ref(10)
const pilihSektor = s => { sektor.value = s; nSektor.value = 10 }
const lolosSektor = computed(() => lolosPerSektor(basis.value, GAGAL))
const lolosPilih = computed(() => lolosSektor.value[sektor.value] || [])
const sepuluh = computed(() => lolosPilih.value.slice(0, nSektor.value))
const alasan = x => [
  `Laba ${Q} murni ${x.kuartal.status === 'berbalik' ? 'berbalik dari rugi' : pct(x.kuartal.yoy) + ' YoY'}, QoQ ${qoqTeks(x.kuartal)}`,
  `Pendapatan ${pct(x.pendapatan?.pct)}${x.marginKotor ? `, margin kotor ${fmt(x.marginKotor.dari, 1)}% → ${fmt(x.marginKotor.ke, 1)}%` : ''}`,
  `PE TTM ${fmt(x.kuartal.pe, 1)}×${x.kuartal.peMedian ? ` (median IHSG ${fmt(x.kuartal.peMedian, 1)}×)` : ''}${x.kuartal.pbv ? ` · PBV ${fmt(x.kuartal.pbv, 2)}×` : ''}`]

// Unduh riset (PDF, format sama dengan tab Pola Broker/Recovery/Low).
const busyPdf = ref(false), errPdf = ref('')
async function unduhPdf() {
  busyPdf.value = true; errPdf.value = ''
  try {
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../lib/daftarPdf.js')])
    const label = KAT.find(k => k[0] === kat.value)[1]
    const spec = { seri: 'Riset LK', judul: per.value === 'musim' ? `${M.label}: Laporan Keuangan ${Q} ${M.tahun}` : `${M.label}: Laporan Keuangan Terbaru`, label: `${label.toUpperCase()} · ${PERIODE.find(p => p[0] === per.value)[1].toUpperCase()}`,
      sub: 'Laporan keuangan terbaru seluruh emiten BEI dari ringkasan Stockbit Reports, satu laporan terakhir per emiten.',
      updated: data.value.updated, box: [['Laba naik >= 20%', String(hitung.value.bagus || 0)], ['Berbalik laba', String(hitung.value.berbalik || 0)], ['Laba turun', String(hitung.value.turun || 0)], ['Rugi', String(hitung.value.rugi || 0)]],
      bagian: [{ judul: label, ket: `Laba bersih ${KUM} (kumulatif) dan laba ${Q} murni (kuartal itu saja) YoY, pendapatan, serta pendorong menurut ringkasan laporan. ${Q} melemah = ${KUM} naik tetapi ${Q} sendiri turun/rugi.`,
        cols: [{ t: 'Saham', w: 15 }, { t: `Laba ${KUM}`, w: 26, align: 'right' }, { t: `${KUM} YoY`, w: 17, align: 'right' }, { t: `${Q} YoY`, w: 22, align: 'right' }, { t: 'Pendapatan', w: 16, align: 'right' }, { t: 'Pendorong / catatan', w: 86 }],
        rows: rows.value.slice(0, 200).map(x => [{ t: x.t, bold: true }, uang(x.laba?.ke), { t: labaPct(x), color: P.warna(x.kategori === 'turun' || x.kategori === 'rugi' ? -1 : 1) },
          { t: q3Pct(x.kuartal) + (x.kuartal?.melemah ? ' (melemah)' : ''), color: x.kuartal ? P.warna(['naik', 'berbalik'].includes(x.kuartal.status) ? 1 : -1) : undefined },
          { t: pct(x.pendapatan?.pct), color: P.warna(x.pendapatan?.pct) }, [x.pendorong, ...x.catatan].filter(Boolean).join('. ')]) }],
      metode: 'Data dari ringkasan AI Stockbit atas laporan keuangan; verifikasi dengan dokumen sumber. Kenaikan persentase besar dari basis rendah tidak selalu berulang.' }
    ;(await P.daftarPdf(spec, jsPDF)).save(P.daftarPdfName('LK-Bagus'))
  } catch (e) { errPdf.value = 'PDF gagal dibuat: ' + (e.message || e) } finally { busyPdf.value = false }
}
</script>

<template>
  <section class="lk">
    <p class="small muted intro">Laporan keuangan terbaru <b>seluruh emiten BEI</b> dari akun Stockbit Reports, satu laporan terakhir per emiten.
      Diperbarui otomatis tiap 30 menit (06.00–22.00 WIB).</p>
    <div class="unduh"><span v-if="errPdf" class="small c-strong">{{ errPdf }}</span>
      <button type="button" class="btn" :disabled="busyPdf || !data" @click="unduhPdf">{{ busyPdf ? 'Menyiapkan PDF…' : '⬇ Unduh riset LK (PDF)' }}</button></div>
    <p v-if="loading" class="muted">Memuat laporan keuangan…</p>
    <p v-else-if="err" class="muted">{{ err }}</p>
    <template v-else-if="data">
      <p v-if="!data.n" class="muted">Data laporan keuangan sedang dikumpulkan server dari Stockbit Reports; muat ulang beberapa menit lagi.</p>
      <div class="flt" role="group" aria-label="Periode laporan">
        <span class="small muted">Periode:</span>
        <button v-for="[v, l] in PERIODE" :key="v" type="button" class="pill sm" :aria-pressed="String(per === v)" @click="per = v; n = 100">{{ l }}</button>
      </div>
      <div class="kat" role="tablist" aria-label="Kategori LK">
        <button v-for="[k, l] in KAT" :key="k" type="button" role="tab" class="pill" :aria-selected="String(kat === k)" :aria-pressed="String(kat === k)" @click="kat = k; buka = ''; n = 100">
          {{ l }} <span class="muted">{{ k === 'semua' ? basis.length : (hitung[k] || 0) }}</span></button>
      </div>
      <div class="flt" role="group" aria-label="Saringan">
        <input v-model="f.cari" type="search" class="cari" placeholder="Cari kode atau nama…" aria-label="Cari saham" />
        <button type="button" class="pill sm" :aria-pressed="String(f.sehat)" title="Pendapatan ikut naik dan bukan dari basis tahun lalu yang kecil" @click="f.sehat = !f.sehat">Kualitas: pendapatan ikut naik</button>
        <button type="button" class="pill sm" :aria-pressed="String(f.radar)" @click="f.radar = !f.radar">Hanya saham di radar</button>
        <span class="small muted sep" :title="hscInfo()">HSC:</span>
        <button v-for="[v, l] in HSC_OPSI" :key="v" type="button" class="pill sm" :aria-pressed="String(f.hsc === v)" @click="f.hsc = v">{{ l }}</button>
      </div>
      <div class="flt" role="group" aria-label="Kuartal III murni">
        <span class="small muted" :title="`Laba ${Q} saja (bukan kumulatif ${KUM})`">{{ Q }} murni:</span>
        <button v-for="[v, l] in Q3OPSI" :key="v" type="button" class="pill sm" :aria-pressed="String(f.q3 === v)" @click="f.q3 = v">{{ l }}</button>
        <span class="small muted">{{ hitQ3.ada }} emiten terhitung · {{ hitQ3.melemah }} naik di {{ KUM }} tetapi {{ Q }} melemah</span>
      </div>
      <div class="flt" role="group" aria-label="Urutan">
        <span class="small muted">Urutkan:</span>
        <button v-for="[v, l] in URUT" :key="v" type="button" class="pill sm" :aria-pressed="String(f.urut === v)" @click="f.urut = v">{{ l }}</button>
      </div>
      <div class="tiga" aria-label="Terbaik per kelompok">
        <div class="th"><h2>Terbaik per kelompok</h2>
          <span class="small muted">1 saham per kelompok dari seluruh laporan {{ PERIODE.find(p => p[0] === per)[1] }} · tanpa bank & asuransi · syarat: laba {{ Q }} murni lebih besar dari {{ Q }} tahun lalu dan dari kuartal sebelumnya, pendapatan naik · PE TTM terendah · bukan rekomendasi beli/jual</span></div>
        <div class="kartu">
          <div v-for="g in kelompok" :key="g.k" class="k" :class="{ kosong: !g.x }">
            <div class="kl">{{ g.label }}<span v-if="g.p && g.k === 'konglo'" class="muted"> · {{ grupKonglo(g.p.t) }}</span><span v-if="g.p && g.k === 'logam' && komoditas(g.p.t)" class="muted"> · {{ komoditas(g.p.t) }}</span></div>
            <p v-if="g.p && !g.x" class="small warn">Belum ada yang lolos semua syarat; ini kandidat terdekat. Belum terpenuhi: {{ g.gagal.join('; ') }}.</p>
            <template v-if="g.p">
              <div class="kh">
                <RouterLink :to="{ path: '/emiten/' + g.p.t, query: { tab: 'berita' } }"><b>{{ g.p.t }}</b></RouterLink>
                <span v-if="g.p.radar" class="tag t-calm">radar</span>
                <span class="hg"><HargaSaham :kode="g.p.t" /></span></div>
              <div v-if="g.p.nama" class="small muted">{{ g.p.nama }}</div>
              <div class="small lb">Laba {{ KUM }} {{ uang(g.p.laba?.ke) }} <b :class="nada(g.p)">{{ labaPct(g.p) }}</b> · {{ Q }} murni {{ uangQ(g.p.kuartal.laba, g.p.kuartal.mata) }}</div>
              <ul class="small"><li v-for="a in alasan(g.p)" :key="a">{{ a }}</li></ul>
              <p v-if="g.alt.length" class="small muted alt">Pembanding:
                <template v-for="(a, i) in g.alt" :key="a.t"><span v-if="i">, </span><RouterLink :to="{ path: '/emiten/' + a.t, query: { tab: 'berita' } }">{{ a.t }}</RouterLink> PE {{ fmt(a.kuartal.pe, 1) }}×</template></p>
            </template>
            <p v-else class="small muted">Belum ada emiten di kelompok ini.</p>
            <template v-if="g.dekat.length">
              <p class="small alt">{{ g.x ? 'Belum lolos' : 'Kandidat lain' }}:</p>
              <ul class="small muted">
                <li v-for="d in g.dekat" :key="d.r.t"><RouterLink :to="{ path: '/emiten/' + d.r.t, query: { tab: 'berita' } }"><b>{{ d.r.t }}</b></RouterLink>
                  PE {{ fmt(d.r.kuartal.pe, 1) }}× · {{ d.g.join('; ') }}</li>
              </ul>
            </template>
          </div>
        </div>
      </div>
      <div class="tiga" aria-label="Terbaik per sektor">
        <div class="th"><h2>Terbaik per sektor</h2>
          <span class="small muted">sektor sesuai Stockbit · syarat sama dengan kartu di atas · urut PE TTM terendah · bukan rekomendasi beli/jual</span></div>
        <div class="flt" role="tablist" aria-label="Sektor">
          <button v-for="s in [SEMUA, ...SEKTOR]" :key="s" type="button" role="tab" class="pill sm" :aria-selected="String(sektor === s)" :aria-pressed="String(sektor === s)" @click="pilihSektor(s)">
            {{ s }} <span class="muted">{{ (lolosSektor[s] || []).length }}</span></button>
        </div>
        <p v-if="!sepuluh.length" class="small muted">Belum ada emiten {{ sektor === SEMUA ? '' : 'di sektor ini ' }}yang lolos syarat.</p>
        <div v-else class="scroll">
          <table class="ledger">
            <thead><tr><th>#</th><th>Saham</th><th class="num">Harga</th><th class="num">Laba {{ Q }} murni</th><th class="num">{{ Q }} YoY</th><th class="num">{{ Q }} QoQ</th>
              <th class="num">Pendapatan YoY</th><th class="num">PE TTM</th><th class="num">PBV</th><th>{{ sektor === SEMUA ? 'Sektor · industri' : 'Industri' }}</th></tr></thead>
            <tbody>
              <tr v-for="(x, i) in sepuluh" :key="x.id">
                <td class="small">{{ i + 1 }}</td>
                <td><RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'berita' } }"><b>{{ x.t }}</b></RouterLink>
                  <span v-if="x.backdoor" class="tag t-calm">backdoor</span><span v-if="grupKonglo(x.t)" class="tag t-calm" :title="'Grup ' + grupKonglo(x.t)">konglo</span>
                  <div v-if="x.nama" class="small muted nm">{{ x.nama }}</div></td>
                <td class="num"><HargaSaham :kode="x.t" /></td>
                <td class="num small">{{ uangQ(x.kuartal.laba, x.kuartal.mata) }}</td>
                <td class="num"><b class="c-good">{{ q3Pct(x.kuartal) }}</b></td>
                <td class="num small">{{ qoqTeks(x.kuartal) }}</td>
                <td class="num c-good">{{ pct(x.pendapatan?.pct) }}</td>
                <td class="num"><b>{{ fmt(x.kuartal.pe, 1) }}×</b></td>
                <td class="num small">{{ x.kuartal.pbv ? fmt(x.kuartal.pbv, 2) + '×' : '–' }}</td>
                <td class="small muted"><template v-if="sektor === SEMUA">{{ x.kelas.sektor }} · </template>{{ x.kelas?.ind || x.kelas?.sub || '–' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="lolosPilih.length > nSektor" class="small"><button type="button" class="pill sm" @click="nSektor = lolosPilih.length">Tampilkan semua {{ lolosPilih.length }} emiten{{ sektor === SEMUA ? '' : ' ' + sektor }}</button></p>
        <p v-else-if="sepuluh.length && sepuluh.length < 10" class="small muted">Hanya {{ sepuluh.length }} emiten {{ sektor === SEMUA ? '' : 'di sektor ini ' }}yang lolos syarat.</p>
      </div>
      <div class="mh"><h2>{{ KAT.find(k => k[0] === kat)[1] }}</h2>
        <span class="small muted">{{ rows.length }} emiten · {{ PERIODE.find(p => p[0] === per)[1] }} · laporan terakhir {{ data.updated ? fmtDate(data.updated) : '–' }}</span></div>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th>Saham</th><th>Periode</th><th class="num">Harga</th><th class="num">Laba bersih {{ KUM }}</th><th class="num">Laba {{ KUM }} YoY</th><th class="num">Laba {{ Q }} murni</th><th class="num">{{ Q }} YoY</th><th class="num">{{ Q }} QoQ</th>
            <th class="num">Pendapatan YoY</th><th class="num">Margin kotor</th><th>Pendorong</th><th>Tanggal</th></tr></thead>
          <tbody>
            <template v-for="x in rows.slice(0, n)" :key="x.id">
              <tr class="row" :class="{ open: buka === x.id }" tabindex="0" @click="buka = buka === x.id ? '' : x.id" @keydown.enter="buka = buka === x.id ? '' : x.id">
                <td><span class="car">{{ buka === x.id ? '▾' : '▸' }}</span>
                  <RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'berita' } }" @click.stop><b>{{ x.t }}</b></RouterLink>
                  <span v-if="isHsc(x.t)" class="tag t-warn" title="Saham HSC">HSC</span>
                  <span v-if="x.radar" class="tag t-calm" title="Ada di radar backdoor">radar</span>
                  <div v-if="x.nama" class="small muted nm">{{ x.nama }}</div></td>
                <td class="small">{{ x.periode || '–' }}</td>
                <td class="num"><HargaSaham :kode="x.t" /></td>
                <td class="num small">{{ uang(x.laba?.dari) }} → <b>{{ uang(x.laba?.ke) }}</b></td>
                <td class="num"><b :class="nada(x)">{{ labaPct(x) }}</b></td>
                <td class="num small">{{ uangQ(x.kuartal?.laba, x.kuartal?.mata) }}</td>
                <td class="num"><b :class="Q3TXT[x.kuartal?.status] || 'muted'">{{ q3Pct(x.kuartal) }}</b>
                  <div v-if="x.kuartal?.melemah" class="tag t-warn" :title="`Laba ${KUM} naik, tetapi laba ${Q} sendiri turun atau rugi`">{{ Q }} melemah</div></td>
                <td class="num small" :class="(x.kuartal?.qoq ?? 0) >= 0 ? '' : 'c-strong'">{{ qoqTeks(x.kuartal) }}</td>
                <td class="num" :class="(x.pendapatan?.pct ?? 0) >= 0 ? 'c-good' : 'c-strong'">{{ pct(x.pendapatan?.pct) }}</td>
                <td class="num small">{{ x.marginKotor ? fmt(x.marginKotor.dari, 2) + '% → ' + fmt(x.marginKotor.ke, 2) + '%' : '–' }}</td>
                <td class="small dr">{{ x.pendorong || '–' }}</td>
                <td class="small"><a :href="x.url" target="_blank" rel="noopener" @click.stop>{{ fmtDate(x.tgl) }}</a></td>
              </tr>
              <tr v-if="buka === x.id" class="det"><td colspan="12">
                <p class="small"><b>{{ x.judul }}</b> · {{ x.jenisLk }}</p>
                <p class="small">{{ x.ringkas }}</p>
                <ul class="small"><li v-for="p in x.poin" :key="p">{{ p }}</li></ul>
                <p v-if="x.kuartal" class="small"><b>Q{{ x.kuartal.q }} murni</b> ({{ x.kuartal.sumber }}): laba Q{{ x.kuartal.q }} {{ uangQ(x.kuartal.laba, x.kuartal.mata) }}
                  vs Q{{ x.kuartal.q }} tahun lalu {{ uangQ(x.kuartal.labaLalu, x.kuartal.mata) }} ({{ q3Pct(x.kuartal) }})<template v-if="x.kuartal.labaSebelum != null">;
                  kuartal sebelumnya {{ uangQ(x.kuartal.labaSebelum, x.kuartal.mata) }} → QoQ {{ pct(x.kuartal.qoq) }}</template><template v-if="x.kuartal.pendYoy != null">;
                  pendapatan YoY {{ pct(x.kuartal.pendYoy) }}</template>.</p>
                <p v-else class="small muted">Laba kuartal murni belum bisa dihitung: laporan laba rugi kuartalan belum tersedia atau angkanya tidak cocok dengan ringkasan.</p>
                <p v-if="x.catatan.length" class="small muted">Catatan: {{ x.catatan.join(' · ') }}.</p>
              </td></tr>
            </template>
          </tbody>
        </table>
      </div>
      <p v-if="rows.length > n" class="small"><button type="button" class="pill sm" @click="n += 100">Tampilkan 100 lagi ({{ rows.length - n }} tersisa)</button></p>
      <p class="small muted"><b>Laba naik ≥ 20%</b> = laba bersih YoY naik minimal 20%; <b>Berbalik laba</b> = periode lalu rugi, kini laba.
        <b>Laba {{ Q }} murni</b> = laba kuartal itu saja, dari laporan laba rugi kuartalan Stockbit (atau laba {{ KUM }} dikurangi kuartal sebelumnya bila belum tercatat, setelah dicek cocok dengan angka tahun lalu), sehingga terlihat bila kenaikan {{ KUM }}
        hanya ditopang kuartal-kuartal sebelumnya; <b>{{ Q }} melemah</b> = laba {{ KUM }} naik tetapi laba {{ Q }} sendiri turun atau rugi. QoQ = dibanding kuartal sebelumnya.
        Nama tab dan periode berganti otomatis mengikuti musim laporan (Jan–Mar Q4, Apr–Jun Q1, Jul–Sep Q2, Okt–Des Q3).
        Saringan <b>Kualitas</b> menyisakan emiten yang pendapatannya ikut naik dan kenaikannya bukan dari basis tahun lalu yang kecil.
        Angka dari ringkasan AI Stockbit; verifikasi dengan dokumen sumber (klik tanggal).</p>
    </template>
  </section>
</template>

<style scoped>
.intro{margin:0 0 6px}.unduh{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin:0 0 8px}
.kat,.flt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.sep{margin-left:8px}
.cari{padding:5px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:inherit;min-width:180px}
.mh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mh h2{margin:8px 0 6px}
.scroll{overflow-x:auto}.row{cursor:pointer}.car{color:var(--ink-2);font-size:11px}.nm{max-width:220px}
.tiga{margin:10px 0 4px}.th{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.th h2{margin:6px 0}
.kartu{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
.k{border:1px solid var(--rule);border-left:4px solid var(--now-ink);background:var(--sheet);padding:10px 12px;border-radius:6px}
.kh{display:flex;align-items:center;gap:8px;font-size:16px}.kh .hg{margin-left:auto;font-size:13px}
.kl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--now-ink);margin-bottom:4px}
.k.kosong{border-left-color:var(--rule)}
.lb{margin:6px 0 2px}.k ul{margin:4px 0 0;padding-left:16px}
.alt{margin:6px 0 0}.warn{margin:2px 0 6px;color:var(--ink-2);font-style:italic}
.dr{min-width:260px;max-width:340px}.det td{background:var(--sheet)}.det p{margin:4px 0}.det ul{margin:4px 0;padding-left:18px}
</style>
