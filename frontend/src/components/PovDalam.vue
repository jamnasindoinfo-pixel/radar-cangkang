<script setup>
// Analisa mendalam satu emiten (POV). Server menarik seluruh saham BEI bertahap di latar dan menyimpan hasilnya;
// analisa tersimpan langsung tampil dan ditarik ulang bila ada data baru (keterbukaan informasi atau perubahan
// pemegang saham). Saham yang belum dianalisa ditarik saat tombol diklik (maks. 15 menit), dipantau tiap beberapa detik.
// Isi: kepemilikan & jaringan pengendali di emiten lain, emiten grup, riwayat kepemilikan, orang dalam, aksi korporasi,
// kinerja, diskusi komunitas, dugaan tujuan, dan yang diselidiki.
import { computed, onBeforeUnmount, ref } from 'vue'
import { api } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'
import { pdPerluTarikUlang, pdPerluPantau, pdCakupan } from '../lib/povDalamStatus.js'
import { analisaInsider } from '../lib/insiderAnalisa.js'

const props = defineProps({ ticker: { type: String, required: true } })
const st = ref(null), err = ref(''), busyPdf = ref(false), busyIns = ref(false)
// Keterbukaan pemegang saham terbaru (IDX & KSEI): pemegang baru >=5% ditampilkan dan ikut di PDF, walau analisa
// tersimpan dibuat sebelum data itu masuk.
const insRows = ref([])
api.get('/api/insider-rows', { ticker: props.ticker }).then(j => { insRows.value = j.rows || [] }, () => {})
const ins = computed(() => insRows.value.length ? analisaInsider(insRows.value, hasil.value) : null)
let timer = null, diminta = false
const hasil = computed(() => st.value?.status === 'selesai' ? st.value.hasil : null)
// Hanya klaim yang didukung data yang ditampilkan.
const klaimValid = computed(() => (hasil.value?.klaim || []).filter(c => c.status === 'didukung data'))
// Informasi publik: yang cocok dengan data kepemilikan dulu, lalu rumor/klaim beserta sumbernya.
const verif = computed(() => {
  const k = hasil.value?.komunitas || {}
  return [...(k.relasi || []).filter(r => r.terverifikasi).map(r => ({ k: r.orang + r.badan, teks: `${r.orang} melalui ${r.badan} (@${r.user})`, url: r.url })),
    ...(k.nama || []).filter(e => e.terverifikasi).map(e => ({ k: e.nama, teks: `${e.nama}: tercatat di data pemegang saham/pengurus (disebut ${e.n}x)` }))]
})
const rumor = computed(() => {
  const k = hasil.value?.komunitas || {}
  return [...(k.relasi || []).filter(r => !r.terverifikasi).map(r => ({ k: r.orang + r.badan, teks: `${r.orang} melalui ${r.badan} (@${r.user})`, url: r.url })),
    ...(k.klaim || []).slice(0, 8).map(c => ({ k: c.teks, teks: `${c.teks} (@${c.user}, ${fmtDate(c.d)})`, url: c.url }))]
})
const p2 = v => v == null ? '–' : fmt(v, 2) + '%'
// Galian lanjutan (server povgali); analisa tersimpan versi lama tidak memilikinya.
const g = computed(() => hasil.value?.galian || null)
// Tinggi batang diskalakan min–maks agar perubahan jumlah pemegang terlihat.
const ritelTinggi = computed(() => {
  const n = (g.value?.ritel?.seri || []).map(s => s.n), lo = Math.min(...n), hi = Math.max(...n)
  return v => hi > lo ? Math.round(12 + 88 * (v - lo) / (hi - lo)) : 60
})
const menit = s => s >= 90 ? `± ${Math.round(s / 60)} menit` : `± ${Math.max(10, Math.round(s / 10) * 10)} detik`

async function tanya(mulai = false) {
  try {
    st.value = await api.get('/api/pov-dalam', { ticker: props.ticker, ...(mulai ? { mulai: 1 } : {}) })
    err.value = ''
  } catch (e) { err.value = e.message || String(e) }
  clearTimeout(timer)
  if (pdPerluTarikUlang(st.value, diminta)) {
    diminta = true
    return tanya(true)
  }
  if (pdPerluPantau(st.value)) timer = setTimeout(() => tanya(), 4000)
}
tanya()
onBeforeUnmount(() => clearTimeout(timer))

async function unduh() {
  busyPdf.value = true
  try {
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../lib/povDalamPdf.js')])
    ;(await P.povDalamPdf(hasil.value, jsPDF, ins.value)).save(P.povDalamPdfName(hasil.value))
  } catch (e) { err.value = 'PDF gagal: ' + (e.message || e) } finally { busyPdf.value = false }
}
async function unduhInsider() {
  busyIns.value = true
  try {
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../lib/insiderPdf.js')])
    const a = ins.value || analisaInsider([], hasil.value)
    ;(await P.insiderPdf({ t: props.ticker, nama: hasil.value?.nama, a }, jsPDF)).save(P.insiderPdfName(props.ticker, a))
  } catch (e) { err.value = 'PDF gagal: ' + (e.message || e) } finally { busyIns.value = false }
}
</script>

<template>
  <div class="pd">
    <p v-if="err" class="small c-strong">{{ err }}</p>
    <template v-if="!st || st.status === 'kosong' || st.status === 'gagal' || st.status === 'antre'">
      <p v-if="st?.galat" class="small c-strong">{{ st.galat }}</p>
      <button type="button" class="btn" :disabled="!st" @click="tanya(true)">🔎 Analisa mendalam {{ ticker }}</button>
      <p class="small muted">Analisa {{ ticker }} belum tersimpan. Server menarik profil, pemegang saham, jaringan kepemilikan di emiten lain, keterbukaan 1 tahun, berita, kinerja, dan posting publik Stockbit.
        Lama proses bergantung banyaknya data (umumnya 2–5 menit, paling lama 15 menit); perkiraannya ditampilkan setelah diklik.</p>
      <p v-if="pdCakupan(st?.cakupan)" class="small muted">{{ pdCakupan(st.cakupan) }}</p>
    </template>
    <div v-else-if="st.status === 'jalan'" class="prog" role="status">
      <b>Menarik data {{ ticker }}…</b> perkiraan {{ menit(st.estimasi || 180) }} · berjalan {{ menit(st.berjalan || 0).replace('± ', '') }}
      <div class="bar"><i :style="{ width: Math.min(100, Math.round(((st.langkah || 0) / (st.total || 8)) * 100)) + '%' }"></i></div>
      <span class="small muted">Tahap {{ st.langkah || 0 }}/{{ st.total || 8 }} · {{ st.label }}. Halaman boleh ditinggal; hasil disimpan dan ditarik ulang otomatis bila ada data baru.</span>
    </div>

    <template v-if="hasil">
      <div class="hd">
        <span class="small muted">Dianalisa {{ hasil.dibuat }} · {{ hasil.durasi ? Math.round(hasil.durasi / 60 * 10) / 10 + ' menit' : '' }} ·
          {{ hasil.sumber.pemegang }} pemegang, {{ hasil.sumber.jaringan }} emiten jaringan, {{ hasil.sumber.keterbukaan }} keterbukaan, {{ hasil.sumber.posting }} posting</span>
        <button type="button" class="btn" :disabled="busyPdf" @click="unduh">{{ busyPdf ? 'Menyiapkan PDF…' : '⬇ Unduh analisa mendalam (PDF)' }}</button>
        <button type="button" class="btn" :disabled="busyIns" @click="unduhInsider">{{ busyIns ? 'Menyiapkan PDF…' : '⬇ Khusus insider (PDF)' }}</button>
      </div>
      <div v-if="st.segarkan" class="prog" role="status">
        <b>Menarik ulang {{ ticker }}…</b> <span class="small">{{ st.basi || 'Ada data baru.' }} Analisa di bawah masih versi sebelumnya.</span>
        <div class="bar"><i :style="{ width: Math.min(100, Math.round(((st.segarkan.langkah || 0) / (st.segarkan.total || 10)) * 100)) + '%' }"></i></div>
        <span class="small muted">Tahap {{ st.segarkan.langkah || 0 }}/{{ st.segarkan.total || 10 }} · {{ st.segarkan.label }}</span>
      </div>
      <p v-else-if="st.basi" class="small muted">{{ st.basi }} {{ st.galatSegar || '' }}</p>
      <ul class="small rk"><li v-for="r in hasil.ringkas" :key="r">{{ r }}</li></ul>
      <div v-if="ins?.baru.length" class="baruIns" role="note">
        <b>Pemegang baru ≥5% (90 hari)</b>
        <p v-for="k in ins.kalimat" :key="k" class="small">{{ k }}</p>
        <p v-for="b in ins.baru" :key="b.nama + b.date" class="small muted">{{ b.tafsir }}</p>
        <ul v-if="ins.cek.length" class="small"><li v-for="c in ins.cek" :key="c">{{ c }}</li></ul>
        <p v-if="ins.analisa?.lama" class="small muted">Analisa di bawah dibuat {{ hasil.dibuat }}, sebelum data ini; server menariknya ulang bila ada data baru.</p>
      </div>

      <template v-if="hasil.arah">
        <h3>Membaca arah pengendali</h3>
        <p v-for="n in hasil.arah.narasi" :key="n" class="small nar">{{ n }}</p>
        <h4>Skenario ke mana saham dibawa</h4>
        <div v-for="(s, i) in hasil.arah.skenario" :key="s.nama" class="sk">
          <div class="skh"><b>{{ i + 1 }}. {{ s.nama }}</b><span class="skb"><i :style="{ width: s.skor + '%' }"></i></span><span class="small">skor {{ s.skor }}</span></div>
          <ul class="small"><li v-for="b in s.bukti" :key="b">{{ b }}</li></ul>
          <p class="small muted">Konfirmasi yang ditunggu: {{ s.konfirmasi.join('; ') }}</p>
        </div>
      </template>

      <template v-if="hasil.pertanyaan?.length">
        <h3>Jawaban pertanyaan kunci</h3>
        <div v-for="q in hasil.pertanyaan" :key="q.q" class="dg pos">
          <b>{{ q.q }}</b>
          <p class="small nar">{{ q.a }}</p>
          <ul v-if="q.bukti.length" class="small muted"><li v-for="b in q.bukti" :key="b">{{ b }}</li></ul>
        </div>
      </template>

      <template v-if="hasil.backdoor">
        <h3>Potensi backdoor / ganti pengendali: skor {{ hasil.backdoor.skor }}</h3>
        <div class="skh"><span class="skb wide"><i :style="{ width: hasil.backdoor.skor + '%' }"></i></span></div>
        <ul class="small"><li v-for="b in hasil.backdoor.bukti" :key="b">{{ b }}</li><li v-if="!hasil.backdoor.bukti.length" class="muted">Belum ada tanda yang biasa mendahului backdoor.</li></ul>
        <template v-if="hasil.jejakCangkang?.length">
          <h4>Rekam jejak penjual cangkang</h4>
          <ul class="small"><li v-for="j in hasil.jejakCangkang" :key="j.t + j.pemegang"><b>{{ j.teks }}</b></li></ul>
        </template>
        <template v-if="hasil.backdoor.rups?.length">
          <h4>Agenda RUPS / keterbukaan perubahan</h4>
          <ul class="small"><li v-for="r in hasil.backdoor.rups" :key="r">{{ r }}</li></ul>
        </template>
      </template>

      <!-- Galian lanjutan: tahapan backdoor, harga pengalihan, rekam jejak, lintas emiten, broker, nominee, ritel. -->
      <template v-if="g">
        <h3>Kalender tahapan backdoor</h3>
        <p class="small nar"><b>{{ g.kalender.ringkas }}</b> {{ g.kalender.berikut }}</p>
        <ol class="small tahap">
          <li v-for="x in g.kalender.tahap" :key="x.n" :class="{ ok: x.status === 'terjadi', kini: x.n === g.kalender.posisi }">
            <b>{{ x.nama }}</b> <span class="tag" :class="x.status === 'terjadi' ? 't-good' : 't-calm'">{{ x.status === 'terjadi' ? 'terjadi ' + (x.tgl || '') : 'belum terlihat' }}</span>
            <div class="muted">{{ x.arti }}</div>
            <ul v-if="x.bukti.length"><li v-for="b in x.bukti" :key="b">{{ b }}</li></ul>
          </li>
        </ol>

        <template v-if="g.harga.rows.length || g.harga.dokumen.length">
          <h3>Harga pengalihan vs harga pasar</h3>
          <div class="scroll"><table v-if="g.harga.rows.length" class="ledger small">
            <thead><tr><th>Tanggal</th><th>Pihak</th><th>Arah</th><th class="num">Poin</th><th class="num">Harga transaksi</th><th class="num">Harga pasar</th><th class="num">Selisih</th></tr></thead>
            <tbody><tr v-for="r in g.harga.rows" :key="r.date + r.nama">
              <td>{{ fmtDate(r.date) }}</td><td>{{ r.nama }}</td><td>{{ r.arah }}</td><td class="num">{{ r.chg == null ? '–' : fmt(r.chg, 2) }}</td>
              <td class="num">Rp{{ fmt(r.harga, 0) }}</td><td class="num">{{ r.pasar ? 'Rp' + fmt(r.pasar, 0) : '–' }}</td>
              <td class="num" :class="(r.selisih || 0) >= 0 ? 'c-good' : 'c-strong'">{{ r.selisih == null ? '–' : (r.selisih > 0 ? '+' : '') + fmt(r.selisih, 1) + '%' }}</td></tr></tbody>
          </table></div>
          <ul v-if="g.harga.dokumen.length" class="small"><li v-for="d in g.harga.dokumen" :key="d.url + d.harga">{{ fmtDate(d.date) }} · <a :href="d.url" target="_blank" rel="noopener">{{ d.judul }}</a>: <b>Rp{{ fmt(d.harga, 0) }}</b> <span class="muted">({{ d.konteks }})</span></li></ul>
          <ul class="small"><li v-for="x in g.harga.catatan" :key="x"><b>{{ x }}</b></li></ul>
        </template>

        <template v-if="g.rekam.emiten.length || g.rekam.berita.length">
          <h3>Rekam jejak UBO & emiten jaringannya</h3>
          <ul class="small"><li v-for="x in g.rekam.catatan" :key="x"><b>{{ x }}</b></li></ul>
          <ul class="small"><li v-for="e in g.rekam.emiten" :key="e.t">{{ e.teks }}</li></ul>
          <ul v-if="g.rekam.berita.length" class="small"><li v-for="b in g.rekam.berita" :key="b.url">{{ b.date ? fmtDate(b.date) : '–' }} <span v-for="k in b.kategori" :key="k" class="tag t-warn">{{ k }}</span>
            <a :href="b.url" target="_blank" rel="noopener">{{ b.judul }}</a> <span class="muted">— {{ b.sumber }}</span></li></ul>
        </template>

        <template v-if="g.pengurus.length || g.alamat.length">
          <h3>Jejak pengurus, pemegang, dan alamat lintas emiten</h3>
          <ul class="small">
            <li v-for="x in g.pengurus" :key="x.nama"><b>{{ x.nama }}</b> <span class="muted">({{ x.peran }})</span> juga:
              <template v-for="(e, i) in x.emiten" :key="e.t"><span v-if="i">, </span>{{ e.t }} <span class="muted">{{ e.sebagai }}</span></template></li>
            <li v-for="a in g.alamat" :key="'a' + a.t"><b>{{ a.t }}</b> <span class="tag t-calm">{{ a.dasar }}</span> <span class="muted">{{ a.alamat }}</span></li>
          </ul>
        </template>

        <template v-if="g.broker.rows.length">
          <h3>Identitas broker & sekuritas grup</h3>
          <ul class="small"><li v-for="x in g.broker.catatan" :key="x"><b>{{ x }}</b></li></ul>
          <ul class="small"><li v-for="r in g.broker.rows" :key="r.b"><b>{{ r.b }}</b> {{ r.nama || 'nama belum dipetakan' }} <span class="tag t-calm">{{ r.jenis }}</span>
            <span v-if="r.grup" class="tag" :class="r.satuGrup ? 't-warn' : 't-calm'">grup {{ r.grup }}{{ r.satuGrup ? ' · satu grup' : '' }}</span> <span class="muted">{{ r.peran.join('; ') }}</span></li></ul>
        </template>

        <template v-if="g.nominee.length">
          <h3>Deteksi nominee (indikasi)</h3>
          <ul class="small"><li v-for="n in g.nominee" :key="n.nama"><b>{{ n.nama }}</b> {{ p2(n.pct) }} <span v-if="n.kuat" class="tag t-warn">indikasi kuat</span>: {{ n.tanda.join('; ') }}</li></ul>
        </template>

        <template v-if="g.ritel.seri.length">
          <h3>Tren jumlah pemegang saham (KSEI)</h3>
          <ul class="small"><li v-for="x in g.ritel.catatan" :key="x"><b>{{ x }}</b></li></ul>
          <div class="ritel" role="img" :aria-label="'Jumlah pemegang saham ' + g.ritel.seri.length + ' bulan'">
            <span v-for="s in g.ritel.seri" :key="s.d" :title="fmtDate(s.d) + ': ' + fmt(s.n, 0) + ' pemegang'"><i :style="{ height: ritelTinggi(s.n) + '%' }"></i></span>
          </div>
          <p class="small muted">{{ fmtDate(g.ritel.seri[0].d) }} – {{ fmtDate(g.ritel.seri.at(-1).d) }} · terakhir {{ fmt(g.ritel.seri.at(-1).n, 0) }} pemegang.</p>
        </template>
      </template>

      <template v-if="hasil.afiliasi?.kelompok?.length">
        <h3>Peta afiliasi · terhubung {{ p2(hasil.afiliasi.totalTerhubung) }}</h3>
        <div v-for="k in hasil.afiliasi.kelompok" :key="k.jenis + k.dasar" class="dg pos">
          <span class="tag t-calm">{{ k.jenis }}</span> <b>{{ p2(k.pct) }}</b> · {{ k.dasar }}
          <div class="small">{{ k.anggota.join(', ') }}</div>
        </div>
      </template>

      <template v-if="hasil.marketMaker?.length">
        <h3>Market maker: broker yang dipakai orang dalam</h3>
        <ul class="small"><li v-for="m in hasil.marketMaker" :key="m">{{ m }}</li></ul>
      </template>

      <template v-if="hasil.target?.length">
        <h3>Skenario target harga (distribusi)</h3>
        <ul class="small"><li v-for="x in hasil.target" :key="x.label"><b>{{ x.label }}: Rp{{ fmt(x.harga, 0) }}</b>
          <span :class="x.potensi >= 0 ? 'c-good' : 'c-strong'">({{ x.potensi > 0 ? '+' : '' }}{{ fmt(x.potensi, 1) }}%)</span> — {{ x.dasar }}</li></ul>
        <p class="small muted">Skenario dari data, bukan rekomendasi atau janji harga.</p>
      </template>

      <template v-if="hasil.sudut?.length">
        <h3>Sudut yang sering terlewat</h3>
        <ul class="small"><li v-for="x in hasil.sudut" :key="x">{{ x }}</li></ul>
      </template>

      <template v-if="hasil.bandarmologi?.fase?.length">
        <h3>Bandarmologi</h3>
        <table class="ledger small">
          <thead><tr><th>Periode</th><th class="num">Net bandar</th><th class="num">Harga</th><th>Pembeli utama</th><th>Penjual utama</th><th class="num">Modal pembeli</th><th>Arti</th></tr></thead>
          <tbody><tr v-for="f in hasil.bandarmologi.fase" :key="f.hari">
            <td>{{ f.periode }}</td><td class="num" :class="f.bandar > 0 ? 'c-good' : 'c-strong'">Rp{{ fmt(f.bandar / 1e9, 2) }} M</td>
            <td class="num">{{ f.harga == null ? '–' : (f.harga > 0 ? '+' : '') + fmt(f.harga, 1) + '%' }}</td>
            <td>{{ f.akum.join(', ') }}</td><td>{{ f.dist.join(', ') }}</td>
            <td class="num">{{ f.avgAkum ? 'Rp' + fmt(f.avgAkum, 0) : '–' }}</td><td>{{ f.arti }}</td></tr></tbody>
        </table>
        <ul class="small"><li v-for="x in hasil.bandarmologi.catatan" :key="x">{{ x }}</li></ul>
      </template>

      <template v-if="hasil.volume?.length">
        <h4>Jejak lonjakan volume (1 tahun)</h4>
        <ul class="small"><li v-for="v in hasil.volume" :key="v.d">{{ fmtDate(v.d) }}: {{ v.kali }}x rata-rata, harga {{ (v.ubah > 0 ? '+' : '') + v.ubah }}%<b v-if="v.sebelum"> — sebelum: {{ v.sebelum }}</b></li></ul>
      </template>
      <template v-if="hasil.preseden?.length">
        <h4>Preseden grup (2 tahun)</h4>
        <ul class="small"><li v-for="x in hasil.preseden" :key="x">{{ x }}</li></ul>
      </template>

      <template v-if="klaimValid.length">
        <h3>Klaim publik yang terbukti data</h3>
        <div v-for="c in klaimValid" :key="c.jenis + c.user" class="dg" :class="c.status === 'didukung data' ? 'pos' : ''">
          <span class="tag" :class="c.status === 'didukung data' ? 't-good' : c.status === 'tidak didukung' ? 't-strong' : 't-calm'">{{ c.status }}</span>
          “{{ c.klaim }}” <a :href="c.url" target="_blank" rel="noopener" class="small">@{{ c.user }} · {{ fmtDate(c.d) }}</a>
          <ul class="small"><li v-for="b in c.bukti" :key="b">{{ b }}</li></ul>
        </div>
      </template>

      <h3>Dugaan tujuan</h3>
      <p v-if="!hasil.dugaan.length" class="small muted">Belum ada bukti yang cukup untuk menyusun dugaan tujuan.</p>
      <div v-for="g in hasil.dugaan" :key="g.judul" class="dg" :class="g.arah > 0 ? 'pos' : ''">
        <b>{{ g.judul }}</b> <span class="tag t-calm">keyakinan {{ g.keyakinan }}</span>
        <ul class="small"><li v-for="b in g.bukti" :key="b">{{ b }}</li></ul>
      </div>

      <template v-if="hasil.radarSikap">
        <h3>Sikap analisa radar: {{ hasil.radarSikap.sikap }}</h3>
        <p class="small">{{ hasil.radarSikap.ringkas }}<template v-if="hasil.radarSikap.nilaiWajar?.atas"> · nilai wajar Rp{{ hasil.radarSikap.nilaiWajar.bawah || '–' }}–{{ hasil.radarSikap.nilaiWajar.atas }}</template></p>
      </template>

      <h3>Kepemilikan · terafiliasi {{ p2(hasil.kepemilikan.nonPublik) }} · free float efektif {{ p2(hasil.kepemilikan.ffEfektif) }} · free float Stockbit {{ p2(hasil.identitas.freeFloat) }}</h3>
      <ul class="small">
        <li v-for="p in hasil.kepemilikan.pemegang" :key="p.name"><b>{{ p.name }}</b> {{ p2(p.pct) }}<span v-if="p.pengendali" class="tag t-warn">pengendali</span><span v-if="p.pengurus" class="tag t-calm">pengurus: {{ p.pengurus }}</span><span v-if="p.keluarga" class="tag t-calm">keluarga {{ p.keluarga }}</span></li>
        <li v-for="k in hasil.kepemilikan.keluarga || []" :key="'k' + k.nama"><b>Keluarga {{ k.nama }}</b>: {{ k.anggota.length }} anggota, total {{ p2(k.pct) }}</li>
        <li v-if="hasil.kepemilikan.ubo.length">UBO: {{ hasil.kepemilikan.ubo.join(', ') }}</li>
      </ul>
      <p class="small muted">Direksi: {{ hasil.kepemilikan.direksi.join(', ') || '–' }} · Komisaris: {{ hasil.kepemilikan.komisaris.join(', ') || '–' }}</p>

      <h3>Jaringan pemegang saham di emiten lain</h3>
      <p v-if="!hasil.jaringan.some(r => r.emiten.length || r.keluar?.length)" class="small muted">Pemegang saham utama tidak tercatat memiliki emiten lain.</p>
      <ul class="small">
        <li v-for="r in hasil.jaringan.filter(r => r.emiten.length || r.keluar?.length)" :key="r.nama"><b>{{ r.nama }}</b> ({{ p2(r.pct) }}):
          <template v-for="(e, i) in r.emiten" :key="e.t"><span v-if="i">, </span><RouterLink :to="'/emiten/' + e.t">{{ e.t }}</RouterLink> {{ p2(e.pct) }}</template>
          <template v-if="r.keluar?.length"> · <span class="c-strong">dilepas:</span> <template v-for="(e, i) in r.keluar" :key="'k' + e.t"><span v-if="i">, </span>{{ e.t }}<span class="muted"> ({{ e.tgl || '–' }})</span></template></template></li>
        <li v-for="x in hasil.bersama" :key="'b' + x.t"><b>{{ x.t }}</b> dimiliki bersama oleh {{ x.pemegang.join(', ') }}</li>
      </ul>
      <template v-if="hasil.grup?.length">
        <h4>Emiten grup</h4>
        <ul class="small"><li v-for="g in hasil.grup" :key="g.t"><b>{{ g.t }}</b> {{ g.nama }} <span class="muted">{{ g.sektor }}</span> — {{ g.pemegang.map(p => p.name + ' ' + (p.pct || '')).join('; ') }}</li></ul>
      </template>

      <h3>Riwayat kepemilikan (3 tahun) dan orang dalam (180 hari)</h3>
      <p v-if="!hasil.riwayat.length" class="small muted">Tidak ada perubahan kepemilikan besar.</p>
      <ul class="small"><li v-for="r in hasil.riwayat" :key="r.date + r.nama">{{ fmtDate(r.date) }} · {{ r.teks }}</li></ul>
      <ul v-if="hasil.insider.length" class="small"><li v-for="x in hasil.insider" :key="x.nama">{{ x.nama }}<span v-if="x.role"> ({{ x.role }})</span>:
        <b :class="x.chg > 0 ? 'c-good' : 'c-strong'">{{ x.chg > 0 ? '+' : '' }}{{ fmt(x.chg, 2) }} poin</b>, {{ x.n }} transaksi, terakhir {{ fmtDate(x.akhir) }}<template v-if="x.lembar">; {{ fmt(x.lembar / 1e6, 1) }} juta lembar<template v-if="x.harga"> @ ±Rp{{ fmt(x.harga, 0) }}</template></template><template v-if="x.sisa">;
          sisa {{ fmt(x.sisa / 1e6, 1) }} juta lembar ({{ p2(x.sisaPct) }})</template><b v-if="x.habisBulan">; habis ± {{ Math.round(x.habisBulan) }} bulan lagi bila laju sama</b></li></ul>

      <template v-if="hasil.tokoh?.length">
        <h3>Profil tokoh (UBO, pemegang perorangan, komut, dirut)</h3>
        <div v-for="o in hasil.tokoh" :key="o.nama" class="dg"><b>{{ o.nama }}</b>
          <ul class="small"><li v-for="b in o.berita" :key="b.url">{{ b.date ? fmtDate(b.date) : '–' }} · <a :href="b.url" target="_blank" rel="noopener">{{ b.judul }}</a> <span class="muted">— {{ b.sumber }}</span></li>
            <li v-if="!o.berita.length" class="muted">Tidak ada pemberitaan publik yang memuat nama ini.</li></ul></div>
      </template>

      <template v-if="hasil.kronologi?.length">
        <h3>Kronologi</h3>
        <ul class="small kr"><li v-for="k in hasil.kronologi" :key="k.date + k.teks"><b>{{ fmtDate(k.date) }}</b> <span class="tag" :class="k.jenis === 'aksi' ? 't-calm' : 't-warn'">{{ k.jenis }}</span> {{ k.teks }}</li></ul>
      </template>

      <h3>Aksi korporasi (1 tahun)</h3>
      <p v-if="!hasil.aksi.length" class="small muted">Tidak ada keterbukaan aksi korporasi yang terbaca.</p>
      <ul class="small"><li v-for="x in hasil.aksi" :key="x.url + x.judul">{{ fmtDate(x.date) }} · <a :href="x.url" target="_blank" rel="noopener">{{ x.judul }}</a><span v-if="x.inti" class="muted"> — {{ x.inti }}</span></li></ul>

      <template v-if="hasil.berita?.length">
        <h3>Berita terbaru (Stockbit)</h3>
        <ul class="small"><li v-for="b in hasil.berita" :key="b.url + b.judul">{{ b.date ? fmtDate(b.date) : '–' }} · <a :href="b.url" target="_blank" rel="noopener">{{ b.judul }}</a></li></ul>
      </template>

      <template v-if="hasil.beritaLuar?.length">
        <h3>Berita di luar Stockbit ({{ hasil.beritaLuar.length }})</h3>
        <ul class="small"><li v-for="b in hasil.beritaLuar" :key="b.url">{{ b.date ? fmtDate(b.date) : '–' }} · <a :href="b.url" target="_blank" rel="noopener">{{ b.judul }}</a>
          <span class="muted"> — {{ b.sumber }}</span></li></ul>
      </template>

      <h3>Informasi dari sumber publik</h3>
      <template v-if="verif.length || rumor.length">
        <p class="small"><b class="c-good">Terverifikasi</b> (cocok dengan data pemegang saham/pengurus):</p>
        <ul class="small"><li v-for="v in verif" :key="v.k">{{ v.teks }} <a v-if="v.url" :href="v.url" target="_blank" rel="noopener">sumber</a></li>
          <li v-if="!verif.length" class="muted">Belum ada informasi publik yang cocok dengan data kepemilikan.</li></ul>
        <template v-if="rumor.length">
          <p class="small"><b>Rumor / klaim belum terverifikasi</b> (cek di dokumen sumber):</p>
          <ul class="small muted"><li v-for="v in rumor" :key="v.k">{{ v.teks }} <a :href="v.url" target="_blank" rel="noopener">sumber</a></li></ul>
        </template>
      </template>
      <p v-else class="small muted">Belum ada informasi publik yang bisa diambil untuk saham ini.</p>

      <h3>Yang perlu diselidiki</h3>
      <ol class="small"><li v-for="s in hasil.selidiki" :key="s">{{ s }}</li></ol>
      <p v-if="hasil.catatan?.length" class="small muted">Catatan: {{ hasil.catatan.join(' · ') }}</p>
      <p class="small muted">Disusun otomatis dari data Stockbit; rumor dan klaim yang belum terverifikasi perlu dicek di dokumen sumber. Bukan rekomendasi beli/jual.</p>
    </template>
  </div>
</template>

<style scoped>
.baruIns{margin:8px 0;padding:8px 10px;border-left:3px solid var(--warn);background:var(--warn-bg);border-radius:4px}
.baruIns p{margin:2px 0}.baruIns ul{margin:4px 0;padding-left:18px}
.pd h3{margin:14px 0 4px;font-size:15px}.pd h4{margin:8px 0 2px;font-size:13px}
.pd ul,.pd ol{margin:4px 0;padding-left:18px}
.hd{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0}
.prog{border:1px solid var(--rule);background:var(--sheet);padding:10px 12px;margin:8px 0}
.bar{height:6px;background:var(--rule);border-radius:3px;margin:6px 0}.bar i{display:block;height:100%;background:var(--now-ink);border-radius:3px;transition:width .4s}
.dg{border-left:3px solid var(--rule);padding:2px 0 2px 10px;margin:6px 0}.dg.pos{border-left-color:var(--now-ink)}
.rk{margin:6px 0}
.nar{margin:4px 0;line-height:1.55}
.sk{margin:6px 0;padding:4px 0 4px 10px;border-left:3px solid var(--now-ink)}
.skh{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.skb{flex:0 0 120px;height:6px;background:var(--rule);border-radius:3px}
.tahap li{margin:4px 0}.tahap li.ok>b{color:var(--good-ink,inherit)}.tahap li.kini{background:var(--sheet);outline:1px solid var(--now-ink);padding:2px 6px}
.scroll{overflow-x:auto}
.ritel{display:flex;align-items:flex-end;gap:2px;height:60px;max-width:420px;margin:6px 0}
.ritel span{flex:1;height:100%;display:flex;align-items:flex-end}.ritel i{display:block;width:100%;background:var(--now-ink);border-radius:2px 2px 0 0}
.skb.wide{flex:0 0 240px}.skb i{display:block;height:100%;background:var(--now-ink);border-radius:3px}
</style>
