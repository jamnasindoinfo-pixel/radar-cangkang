<script setup>
// Tab Quiz halaman Harmonic Pattern: menguji hafalan angka dan bentuk pola (10 soal pilihan ganda per putaran).
// Soal dibuat dari tabel POLA yang sama dengan pemindai (lib/harmonikQuiz.js). Nilai terbaik disimpan di browser.
import { computed, ref } from 'vue'
import PolaDiagram from './PolaDiagram.vue'
import { TINGKAT, buatSoal, ulangSoal, rekap } from '../lib/harmonikQuiz.js'

const KUNCI = 'harmonik-quiz-terbaik'
const bacaTerbaik = () => { try { return JSON.parse(localStorage.getItem(KUNCI)) || {} } catch { return {} } }

const tingkat = ref('utama')
const daftar = ref([]), idx = ref(0), pilih = ref(null), jawaban = ref([]), ulangan = ref(false)
const terbaik = ref(bacaTerbaik())

function mulai(qs, ulang = false) {
  daftar.value = qs; idx.value = 0; pilih.value = null; jawaban.value = []; ulangan.value = ulang
}
const putaranBaru = () => mulai(buatSoal(Math.random, tingkat.value))
function gantiTingkat(t) { tingkat.value = t; putaranBaru() }
putaranBaru()

const soal = computed(() => daftar.value[idx.value])
const selesai = computed(() => idx.value >= daftar.value.length)
const nBenar = computed(() => jawaban.value.filter(j => j.tepat).length)
const hasil = computed(() => selesai.value ? rekap(jawaban.value) : null)

function jawab(i) {
  if (pilih.value != null) return
  pilih.value = i
  jawaban.value.push({ ...soal.value, dipilih: i, tepat: i === soal.value.benar })
  if (idx.value === daftar.value.length - 1 && !ulangan.value) simpanTerbaik()
}
function lanjut() { idx.value++; pilih.value = null }

function simpanTerbaik() {
  const r = rekap(jawaban.value), lama = terbaik.value[tingkat.value]
  if (lama != null && lama >= r.persen) return
  terbaik.value = { ...terbaik.value, [tingkat.value]: r.persen }
  try { localStorage.setItem(KUNCI, JSON.stringify(terbaik.value)) } catch { /* penyimpanan browser tidak tersedia */ }
}

const salah = computed(() => jawaban.value.filter(j => !j.tepat))
const ulangiSalah = () => mulai(ulangSoal(salah.value, Math.random, tingkat.value), true)

const kelas = i => pilih.value == null ? '' : i === soal.value.benar ? 'ok' : i === pilih.value ? 'no' : 'redup'
</script>

<template>
  <section class="qz">
    <div class="kepala">
      <h2>Quiz hafalan pola</h2>
      <p class="muted">Sepuluh soal acak dari angka B, D, bentuk pola, posisi D terhadap X, dan letak stop. Jawab tanpa melihat tabel.</p>
    </div>
    <div class="saring">
      <div class="seg" role="radiogroup" aria-label="Cakupan pola">
        <button v-for="(t, k) in TINGKAT" :key="k" type="button" role="radio" :aria-checked="String(tingkat === k)"
          :class="{ on: tingkat === k }" @click="gantiTingkat(k)">{{ t.nama }}</button>
      </div>
      <span v-if="terbaik[tingkat] != null" class="muted kecil">Nilai terbaik: <b>{{ terbaik[tingkat] }}%</b></span>
    </div>

    <div v-if="!selesai" class="kartu">
      <div class="prog">
        <span>{{ ulangan ? 'Ulang yang salah · ' : '' }}Soal {{ idx + 1 }} dari {{ daftar.length }}</span>
        <span>Benar {{ nBenar }}</span>
      </div>
      <div class="bar"><i :style="{ width: (idx / daftar.length * 100) + '%' }" /></div>
      <p class="tanya">{{ soal.tanya }}</p>
      <PolaDiagram v-if="soal.diagram" :key="idx" class="gbr" :diagram="soal.diagram" :w="280" :h="140" />
      <div class="pilihan" :class="{ dua: soal.pilihan.length === 2 }">
        <button v-for="(p, i) in soal.pilihan" :key="p" type="button" :class="kelas(i)" :disabled="pilih != null" @click="jawab(i)">
          <span class="nr">{{ i + 1 }}</span>{{ p }}
        </button>
      </div>
      <div v-if="pilih != null" class="umpan" :class="pilih === soal.benar ? 'ok' : 'no'" role="status">
        <b>{{ pilih === soal.benar ? 'Benar.' : `Kurang tepat. Jawabannya: ${soal.pilihan[soal.benar]}.` }}</b>
        <span>{{ soal.pengingat }}</span>
      </div>
      <button v-if="pilih != null" type="button" class="lanjut" @click="lanjut">
        {{ idx === daftar.length - 1 ? 'Lihat nilai' : 'Soal berikutnya' }}
      </button>
    </div>

    <div v-else class="kartu akhir">
      <p class="nilai"><b>{{ hasil.benar }}</b> dari {{ hasil.total }} benar <span class="muted">({{ hasil.persen }}%)</span></p>
      <p v-if="hasil.persen === 100" class="muted">Semua benar. Ulangi besok untuk memastikan hafalannya menempel.</p>
      <p v-else-if="hasil.lemah.length" class="muted">
        Paling sering salah: {{ hasil.lemah.map(l => `${l.nama} (${l.n})`).join(', ') }}. Baca lagi pengingatnya di bawah.
      </p>
      <ul v-if="salah.length" class="rekap">
        <li v-for="(j, i) in salah" :key="i">
          <p>{{ j.tanya }}</p>
          <p class="kecil">Jawabanmu: <s>{{ j.pilihan[j.dipilih] }}</s> · Benar: <b>{{ j.pilihan[j.benar] }}</b></p>
          <p class="kecil muted">{{ j.pengingat }}</p>
        </li>
      </ul>
      <div class="aksi">
        <button v-if="salah.length" type="button" class="lanjut" @click="ulangiSalah">Ulangi yang salah ({{ salah.length }})</button>
        <button type="button" class="lanjut alt" @click="putaranBaru">Putaran baru</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.qz{display:grid;gap:12px;max-width:720px}
.kepala h2{font-family:var(--f-display);margin:0 0 2px}
.kepala p{margin:0}
.saring{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.seg{display:flex;gap:2px;flex-wrap:wrap}
.seg button{border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);border-radius:14px;padding:4px 10px;cursor:pointer;font:600 12px var(--f-body)}
.seg button.on{background:var(--accent-soft);color:var(--accent);border-color:transparent}
.kecil{font-size:12px}
.kartu{border:1px solid var(--rule);border-radius:10px;background:var(--sheet);padding:16px;display:grid;gap:12px}
.prog{display:flex;justify-content:space-between;font:600 12px var(--f-data);color:var(--ink-2)}
.bar{height:4px;background:var(--rule-2);border-radius:2px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent);transition:width .25s}
.tanya{font:600 17px var(--f-body);margin:0;color:var(--ink)}
.gbr{max-width:320px;justify-self:center;background:var(--sheet-2);border-radius:8px}
.pilihan{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.pilihan button{display:flex;align-items:center;gap:10px;text-align:left;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);
  border-radius:8px;padding:10px 12px;cursor:pointer;font:600 14px var(--f-body)}
.pilihan button:not(:disabled):hover{border-color:var(--accent);background:var(--accent-soft)}
.pilihan button:disabled{cursor:default}
.pilihan .nr{font:700 11px var(--f-data);color:var(--ink-2);border:1px solid var(--rule);border-radius:50%;width:20px;height:20px;
  display:inline-grid;place-items:center;flex:none}
.pilihan button.ok{background:var(--good-bg);border-color:var(--good);color:var(--good)}
.pilihan button.no{background:var(--strong-bg);border-color:var(--strong);color:var(--strong)}
.pilihan button.redup{opacity:.55}
.umpan{display:grid;gap:4px;padding:10px 12px;border-radius:8px;font-size:14px}
.umpan.ok{background:var(--good-bg);color:var(--good)}
.umpan.no{background:var(--strong-bg);color:var(--strong)}
.umpan span{color:var(--ink)}
.lanjut{justify-self:start;border:none;background:var(--accent);color:var(--accent-ink);border-radius:8px;padding:8px 16px;cursor:pointer;font:600 14px var(--f-body)}
.lanjut.alt{background:var(--sheet);color:var(--ink);border:1px solid var(--rule)}
.nilai{font:600 20px var(--f-body);margin:0}
.nilai b{font-family:var(--f-data);font-size:28px}
.akhir p{margin:0}
.rekap{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.rekap li{border-top:1px solid var(--rule-2);padding-top:8px;display:grid;gap:2px}
.rekap s{color:var(--strong)}
.aksi{display:flex;gap:8px;flex-wrap:wrap}
@media (max-width:560px){.pilihan{grid-template-columns:1fr}}
</style>
