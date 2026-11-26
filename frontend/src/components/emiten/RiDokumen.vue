<script setup>
// Fakta penambahan modal dari dokumen asli (lampiran PDF keterbukaan) dan penilaian kewajaran aset injeksi.
import { computed } from 'vue'
import { fmt, rp, big, fmtDate } from '../../lib/domain.js'
import { kewajaranTone, asetLaba } from '../../lib/rightsIssue.js'

// post = { S1: saham setelah penerbitan, P: harga RI simulasi } untuk laba per saham emiten.
// part = bagian yang ditampilkan (aset | pengendali | fakta | sumber); kosong = semua bagian.
const props = defineProps({ doc: { type: Object, required: true }, post: { type: Object, default: () => ({}) }, part: { type: String, default: '' } })
const show = p => !props.part || props.part === p
const lb = computed(() => asetLaba(props.doc, props.post))
// Harga per saham dengan desimal bila tidak bulat (mis. Rp23,5).
const rpD = v => v == null ? '–' : Number.isInteger(+v) ? rp(v) : 'Rp' + fmt(v, 2)
const pg = computed(() => props.doc.pengendali || null)
const kp = computed(() => props.doc.keyPerson || [])
const hk = computed(() => props.doc.hukum || null)
const bs = computed(() => props.doc.bisnis || null)
const pc = v => v == null ? '–' : fmt(v * 100, 1) + '%'
const k = computed(() => props.doc.kewajaran || null)
const a = computed(() => props.doc.aset || {})
// Analisa penilaian aset injeksi (fakta dokumen + simulasi Radar), bila tersedia.
const pn = computed(() => a.value.penilaian || null)
const sh = v => v == null ? 'belum diungkap' : v >= 1e9 ? fmt(v / 1e9, 2) + ' miliar saham' : fmt(v / 1e6, 1) + ' juta saham'
const val = v => v == null ? 'belum diungkap' : big(v)
const hp = computed(() => {
  const h = props.doc.hargaPelaksanaan || {}
  return h.nilai ? `${rp(h.nilai)} (${h.status || 'belum ditetapkan'})` : `Belum ditetapkan${h.keterangan ? ': ' + h.keterangan : ''}`
})
// Satuan rupiah ditulis di depan angka (Rp393.720/saham), satuan lain di belakang (107×).
const metrikVal = m => { if (m.nilai == null) return '–'; const n = fmt(m.nilai, m.nilai >= 100 ? 0 : 1), u = m.satuan || ''; return /^Rp/.test(u) ? `Rp${n}${u.slice(2)}` : n + u }
// Butir fakta utama dari dokumen (yang tidak tersedia disebut "belum diungkap").
const facts = computed(() => {
  const d = props.doc, ke = a.value.keuangan || {}
  return [
    ['Jenis & status', [d.jenis, d.status].filter(Boolean).join(' · ')],
    ['Saham baru (maksimum)', d.sahamBaruMaks ? sh(d.sahamBaruMaks) + (d.rasio ? ` · rasio ${d.rasio}` : '') : 'belum diungkap'],
    ['Harga pelaksanaan', hp.value],
    ['Nilai nominal', d.nominal ? rp(d.nominal) : null],
    ['Dana maksimum', d.danaMaksRp ? big(d.danaMaksRp) : null],
    ['Setoran aset (inbreng)', d.setoran?.asetRp ? big(d.setoran.asetRp) : null],
    ['Setoran tunai', d.setoran?.tunaiRp ? big(d.setoran.tunaiRp) : null],
    ['Kurs dalam dokumen', d.kurs?.nilai ? `${rp(d.kurs.nilai)}/${d.kurs.mataUang || 'USD'}${d.kurs.keterangan ? ' · ' + d.kurs.keterangan : ''}` : null],
    ['Pembeli siaga', d.pembeliSiaga ? (d.pembeliSiaga.ada === true ? 'Ada' + (d.pembeliSiaga.pihak ? ': ' + d.pembeliSiaga.pihak : '') : d.pembeliSiaga.ada === false ? 'Tidak ada' : 'Belum diungkap') + (d.pembeliSiaga.keterangan ? ' · ' + d.pembeliSiaga.keterangan : '') : null],
    ['Komitmen pengendali', d.komitmenPengendali || null],
    ['Aset', a.value.nama ? `${a.value.nama}${a.value.porsiPersen ? ` (${fmt(a.value.porsiPersen, 0)}%)` : ''}` : null],
    ['Nilai 100% aset', a.value.nilai100Rp ? big(a.value.nilai100Rp) : null],
    ['Nilai porsi yang diambil', a.value.nilaiTransaksiRp ? big(a.value.nilaiTransaksiRp) : null],
    ['Dasar nilai', a.value.dasarNilai || null],
    ['KJPP', a.value.kjpp ? [a.value.kjpp.nama, a.value.kjpp.status, a.value.kjpp.nilaiRp ? big(a.value.kjpp.nilaiRp) : a.value.kjpp.nilaiPerSahamRp ? rp(a.value.kjpp.nilaiPerSahamRp) + '/saham' : null, a.value.kjpp.tanggal ? fmtDate(a.value.kjpp.tanggal) : null].filter(Boolean).join(' · ') : null],
    ['Keuangan aset', ke.ekuitasRp != null || ke.totalAsetRp != null || ke.labaBersihRp != null
      ? [ke.periode, ke.standar, ke.auditor && 'audit ' + ke.auditor].filter(Boolean).join(' · ') + ': ' +
        [ke.totalAsetRp != null && 'aset ' + val(ke.totalAsetRp), ke.ekuitasRp != null && 'ekuitas ' + val(ke.ekuitasRp),
          ke.pendapatanRp != null && 'pendapatan ' + val(ke.pendapatanRp), ke.labaBersihRp != null && 'laba bersih ' + val(ke.labaBersihRp)].filter(Boolean).join(', ')
      : null],
    ['Transaksi afiliasi', a.value.afiliasi === true ? 'Ya, penjual terafiliasi dengan pengendali' : a.value.afiliasi === false ? 'Tidak' : null],
  ].filter(([, v]) => v)
})
</script>

<template>
  <div class="rid">
    <!-- Inti: apakah nilai aset injeksi wajar. -->
    <div v-if="k && show('aset')" class="kw" :class="'kw-' + kewajaranTone(k.putusan)">
      <div class="kwh">
        <span class="lbl">Kewajaran nilai aset injeksi</span>
        <b class="put">{{ k.putusan }}</b>
      </div>
      <p v-if="k.ringkas" class="kr">{{ k.ringkas }}</p>
      <table v-if="(k.metrik || []).length" class="ledger met">
        <thead><tr><th>Ukuran</th><th class="num">Nilai</th><th>Perhitungan</th><th>Pembanding</th></tr></thead>
        <tbody>
          <tr v-for="m in k.metrik" :key="m.nama"><td>{{ m.nama }}</td><td class="num"><b>{{ metrikVal(m) }}</b></td><td class="small muted">{{ m.rumus }}</td><td class="small">{{ m.pembanding }}</td></tr>
        </tbody>
      </table>
      <h4>Alasan</h4>
      <ol class="al"><li v-for="x in k.alasan || []" :key="x">{{ x }}</li></ol>
      <p v-if="k.syaratWajar" class="small"><b>Dapat dianggap wajar bila:</b> {{ k.syaratWajar }}</p>
    </div>

    <!-- Penilaian aset injeksi: apa yang diungkap, simulasi, dan yang harus diuji di laporan penilai. -->
    <div v-if="pn && show('aset')" class="lb pn">
      <h4>{{ pn.judul || 'Penilaian aset injeksi' }}</h4>
      <p v-if="pn.ringkas" class="kr">{{ pn.ringkas }}</p>
      <template v-if="(pn.diketahui || []).length">
        <p class="small"><b>Yang sudah diungkap dokumen:</b></p>
        <ul class="small"><li v-for="x in pn.diketahui" :key="x">{{ x }}</li></ul>
      </template>
      <table v-if="(pn.simulasi || []).length" class="ledger met">
        <thead><tr><th>Simulasi</th><th class="num">Nilai</th><th>Perhitungan</th><th>Catatan</th></tr></thead>
        <tbody><tr v-for="m in pn.simulasi" :key="m.nama"><td>{{ m.nama }}</td><td class="num"><b>{{ metrikVal(m) }}</b></td><td class="small muted">{{ m.rumus }}</td><td class="small">{{ m.catatan }}</td></tr></tbody>
      </table>
      <template v-if="(pn.dicermati || []).length">
        <p class="small"><b>Yang harus diuji di laporan penilai:</b></p>
        <ol class="small"><li v-for="x in pn.dicermati" :key="x">{{ x }}</li></ol>
      </template>
      <p v-if="pn.kesimpulan" class="small"><b>Kesimpulan:</b> {{ pn.kesimpulan }}</p>
      <p v-if="pn.asumsi" class="small muted">{{ pn.asumsi }}</p>
    </div>

    <!-- Perhitungan laba aset injeksi. -->
    <div v-if="show('aset')" class="lb">
      <h4>Perhitungan laba aset injeksi</h4>
      <template v-if="lb">
        <table class="ledger met">
          <tbody>
            <tr v-if="lb.pend != null"><td>Pendapatan{{ lb.periode ? ' (' + lb.periode + ')' : '' }}</td><td class="num">{{ big(lb.pend) }}</td><td class="small muted">{{ lb.ltm ? `setahun (${lb.ltm}) = ${big(lb.pendThn)}` : lb.f !== 1 ? `disetahunkan ×${fmt(lb.f, 2)} = ${big(lb.pendThn)}` : 'setahun' }}</td></tr>
            <tr v-if="lb.laba != null"><td>Laba bersih{{ lb.periode ? ' (' + lb.periode + ')' : '' }}</td><td class="num" :class="lb.rugi ? 'c-strong' : ''"><b>{{ big(lb.laba) }}</b></td><td class="small muted">{{ lb.ltm ? `setahun (${lb.ltm}) = ${big(lb.labaThn)}` : lb.f !== 1 ? `disetahunkan ×${fmt(lb.f, 2)} = ${big(lb.labaThn)}` : 'setahun' }}</td></tr>
            <tr v-if="lb.margin != null"><td>Margin laba bersih</td><td class="num">{{ pc(lb.margin) }}</td><td class="small muted">laba ÷ pendapatan</td></tr>
            <tr v-if="lb.roe != null"><td>Imbal hasil ekuitas (ROE)</td><td class="num">{{ pc(lb.roe) }}</td><td class="small muted">laba setahun ÷ ekuitas aset</td></tr>
            <tr v-if="lb.labaPorsi != null"><td>Laba porsi yang diambil</td><td class="num"><b>{{ big(lb.labaPorsi) }}</b></td><td class="small muted">laba setahun × {{ lb.porsi != null ? fmt(lb.porsi * 100, 2) + '%' : '100% (porsi belum diungkap)' }}</td></tr>
            <tr v-if="lb.per != null"><td>PER implisit transaksi</td><td class="num"><b>{{ fmt(lb.per, 1) }}×</b></td><td class="small muted">nilai transaksi {{ big(lb.nilai) }} ÷ laba porsi; artinya ±{{ fmt(lb.per, 0) }} tahun laba untuk menutup harga</td></tr>
            <tr v-else-if="lb.rugi"><td>PER implisit transaksi</td><td class="num c-strong">tidak terhitung</td><td class="small muted">aset merugi: harga tidak ditopang laba</td></tr>
            <tr v-if="lb.ps != null"><td>P/S implisit</td><td class="num">{{ fmt(lb.ps, 2) }}×</td><td class="small muted">nilai transaksi ÷ pendapatan porsi setahun</td></tr>
            <tr v-if="lb.eps != null"><td>Tambahan laba per saham emiten</td><td class="num">Rp{{ fmt(lb.eps, 2) }}</td><td class="small muted">laba porsi ÷ {{ fmt(post.S1 / 1e9, 2) }} miliar saham setelah penerbitan<template v-if="lb.epsYield != null">; {{ pc(lb.epsYield) }} dari harga RI {{ rp(post.P) }}</template></td></tr>
          </tbody>
        </table>
        <p v-if="lb.catatan" class="small muted">{{ lb.catatan }}</p>
      </template>
      <p v-else class="small">Laba dan pendapatan aset <b>belum diungkap</b> di dokumen keterbukaan; nilai transaksi belum dapat diuji terhadap laba.</p>
    </div>

    <!-- Pengendali & key person. -->
    <div v-if="(pg || kp.length) && show('pengendali')" class="lb">
      <h4>Pengendali dan key person</h4>
      <dl v-if="pg" class="fx">
        <div><dt class="small muted">Pengendali</dt><dd class="small"><b>{{ pg.nama || 'belum diungkap' }}</b>{{ pg.negara ? ' (' + pg.negara + ')' : '' }}{{ pg.porsiPersen != null ? ' · ' + fmt(pg.porsiPersen, 2) + '%' : '' }}</dd></div>
        <div v-if="(pg.ubo || []).length"><dt class="small muted">Pemilik manfaat akhir (UBO)</dt><dd class="small">{{ pg.ubo.join(', ') }}</dd></div>
        <div><dt class="small muted">Harga & modal masuk</dt><dd class="small">{{ pg.hargaMasuk ? rpD(pg.hargaMasuk) + '/saham' : 'belum diungkap' }}{{ pg.nilaiMasukRp ? ' · ' + big(pg.nilaiMasukRp) : '' }}{{ pg.tanggalMasuk ? ' · ' + fmtDate(pg.tanggalMasuk) : '' }}</dd></div>
        <div v-if="pg.cara || pg.penjual"><dt class="small muted">Cara masuk</dt><dd class="small">{{ [pg.cara, pg.penjual && 'dari ' + pg.penjual].filter(Boolean).join(' · ') }}</dd></div>
        <div v-if="pg.hargaPTW"><dt class="small muted">Harga tender wajib</dt><dd class="small">{{ rpD(pg.hargaPTW) }}</dd></div>
        <div v-if="pg.rencana"><dt class="small muted">Rencana pengendali</dt><dd class="small">{{ pg.rencana }}</dd></div>
      </dl>
      <table v-if="kp.length" class="ledger met">
        <thead><tr><th>Nama</th><th>Jabatan</th><th>Afiliasi / catatan</th></tr></thead>
        <tbody><tr v-for="p in kp" :key="p.nama + p.jabatan"><td><b>{{ p.nama }}</b></td><td class="small">{{ p.jabatan }}</td><td class="small muted">{{ [p.afiliasi, p.catatan].filter(Boolean).join(' · ') }}</td></tr></tbody>
      </table>
    </div>

    <!-- Riwayat masalah hukum/regulasi dari dokumen resmi. -->
    <div v-if="hk && show('pengendali')" class="lb">
      <h4>Riwayat masalah hukum dan regulasi</h4>
      <p v-if="hk.tidakDitemukan && !(hk.daftar || []).length" class="small">Tidak ditemukan riwayat gugatan, PKPU, sanksi, atau perkara lain di dokumen keterbukaan yang diperiksa.</p>
      <ul v-else class="small">
        <li v-for="h in hk.daftar" :key="h.tanggal + h.isu"><b>{{ h.tanggal ? fmtDate(h.tanggal) : '' }} · {{ h.jenis }}</b> ({{ h.status }}): {{ h.isu }}<span v-if="h.sumber?.judul" class="muted"> · {{ h.sumber.judul }}</span></li>
      </ul>
    </div>

    <!-- Cara menghasilkan laba: model bisnis, proyek, proyeksi. -->
    <div v-if="bs && show('aset')" class="lb">
      <h4>Cara menghasilkan laba</h4>
      <p v-if="bs.model" class="small">{{ bs.model }}</p>
      <p v-if="(bs.sumberPendapatan || []).length" class="small"><b>Sumber pendapatan:</b> {{ bs.sumberPendapatan.join('; ') }}.</p>
      <template v-if="(bs.proyek || []).length">
        <p class="small"><b>Proyek yang sedang dikerjakan:</b></p>
        <ul class="small"><li v-for="p in bs.proyek" :key="p.nama">{{ p.nama }}<template v-if="p.status"> ({{ p.status }})</template><template v-if="p.nilaiRp"> · {{ big(p.nilaiRp) }}</template><template v-if="p.keterangan"> · {{ p.keterangan }}</template></li></ul>
      </template>
      <table v-if="(bs.proyeksi || []).length" class="ledger met">
        <thead><tr><th>Tahun</th><th class="num">Pendapatan</th><th class="num">Laba bersih</th><th>Sumber proyeksi</th></tr></thead>
        <tbody><tr v-for="p in bs.proyeksi" :key="p.tahun"><td>{{ p.tahun }}</td><td class="num">{{ p.pendapatanRp != null ? big(p.pendapatanRp) : '–' }}</td><td class="num"><b>{{ p.labaBersihRp != null ? big(p.labaBersihRp) : '–' }}</b></td><td class="small muted">{{ p.sumber }}</td></tr></tbody>
      </table>
      <p v-else class="small muted">Proyeksi laba belum diungkap di dokumen; gunakan perhitungan laba aset di atas.</p>
      <p v-if="bs.catatan" class="small muted">{{ bs.catatan }}</p>
    </div>

    <details v-if="show('fakta') || show('sumber')" class="dd" open>
      <summary class="lbl">{{ show('fakta') ? 'Fakta dari dokumen asli' : 'Sumber dokumen' }}</summary>
      <dl v-if="show('fakta')" class="fx">
        <div v-for="[l, v] in facts" :key="l"><dt class="small muted">{{ l }}</dt><dd class="small">{{ v }}</dd></div>
      </dl>
      <template v-if="show('fakta') && (doc.penggunaanDana || []).length">
        <h4>Rencana penggunaan dana</h4>
        <ul class="small"><li v-for="p in doc.penggunaanDana" :key="p.pos">{{ p.pos }}<template v-if="p.nilaiRp"> · {{ big(p.nilaiRp) }}</template><template v-if="p.persen"> ({{ fmt(p.persen, 0) }}%)</template></li></ul>
      </template>
      <p v-if="show('fakta') && doc.dampakPublik" class="small"><b>Dampak bagi pemegang saham publik:</b> {{ doc.dampakPublik }}</p>
      <template v-if="show('fakta') && (doc.jadwal || []).length">
        <h4>Jadwal menurut dokumen</h4>
        <ol class="jd small"><li v-for="j in doc.jadwal" :key="j.tahap + j.waktu" :class="{ ok: j.status === 'selesai' }"><b>{{ j.waktu }}</b> · {{ j.tahap }}</li></ol>
      </template>
      <template v-if="show('fakta') && (doc.temuan || []).length">
        <h4>Temuan penting di dokumen</h4>
        <ul class="small"><li v-for="t in doc.temuan" :key="t">{{ t }}</li></ul>
      </template>
      <template v-if="show('sumber') && (doc.sumber || []).length">
        <h4 v-if="part !== 'sumber'">Sumber dokumen</h4>
        <ul class="small src">
          <li v-for="s in doc.sumber" :key="(s.file || s.judul) + s.hal">
            {{ s.tanggal ? fmtDate(s.tanggal) : '' }} · {{ s.judul }}<template v-if="s.hal"> · hal. {{ s.hal }}</template>
            <a v-if="/^https:\/\/emitten-announcement\.stockbit\.com\//.test(s.url || '')" :href="s.url" target="_blank" rel="noopener">PDF</a>
          </li>
        </ul>
      </template>
      <p class="small muted">Diekstrak dari lampiran keterbukaan informasi per {{ fmtDate(doc.asOf || '') }}. Angka yang tidak disebut dokumen ditandai "belum diungkap".</p>
    </details>
  </div>
</template>

<style scoped>
.rid{display:flex;flex-direction:column;gap:12px;margin:12px 0}
.kw{padding:12px 14px;border:1px solid var(--rule);border-left:4px solid var(--rule-2);background:var(--sheet)}
.kw-good{border-left-color:var(--good)} .kw-warn{border-left-color:var(--warn)} .kw-bad{border-left-color:var(--strong)}
.kwh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.put{font:700 20px var(--f-display);text-transform:capitalize}
.kw-good .put{color:var(--good)} .kw-warn .put{color:var(--warn)} .kw-bad .put{color:var(--strong)}
.kr{margin:6px 0 8px;font-weight:600;max-width:90ch}
.met{margin:4px 0 8px}
.met .num{text-align:right;white-space:nowrap}
h4{margin:10px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.al{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:3px;max-width:95ch}
.dd summary{cursor:pointer}
.lb{padding:10px 12px;border:1px solid var(--rule);background:var(--sheet)}
.lb h4{margin-top:0}
.c-strong{color:var(--strong)}
.fx{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px 18px;margin:8px 0}
.fx div{display:flex;flex-direction:column;border-bottom:1px solid var(--rule-2);padding-bottom:4px}
.fx dd{margin:0}
.jd{margin:0;padding-left:20px}
.jd li.ok{color:var(--good)}
.src a{margin-left:6px;font-weight:600}
</style>
