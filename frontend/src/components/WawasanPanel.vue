<script setup>
// Tab Wawasan di halaman Rekomendasi: untuk setiap menu Radar, apa yang sudah ada dan ilmu yang masih kurang beserta
// wawasan baru yang perlu didalami. Dua tampilan: per menu, atau urutan belajar (prioritas). Data di lib/wawasan.js.
import { computed, ref } from 'vue'
import { BAGIAN, PRIORITAS, hitungPrioritas, urutanBelajar } from '../lib/wawasan.js'

const mode = ref('menu')
const pilih = ref('semua')
const nP = hitungPrioritas()
const total = nP[1] + nP[2] + nP[3]
const bagian = computed(() => pilih.value === 'semua' ? BAGIAN : BAGIAN.filter(b => b.id === pilih.value))
const urutan = urutanBelajar()
const kelasP = { 1: 't-strong', 2: 't-warn', 3: 't-calm' }
</script>

<template>
  <section class="ww" aria-label="Wawasan">
    <p class="small ket">Isi Radar sudah banyak: berita, radar backdoor, kandidat cangkang, analisa IHSG, Harmonic Pattern, dan rekomendasi harian.
      Tab ini mencatat ilmu yang masih kurang di setiap menu, ditambah ilmu dasar dunia saham, lengkap dengan alasan, wawasan baru, penjelasan, contoh, dan kesalahan umum.
      Ada {{ total }} topik: <b>{{ nP[1] }}</b> dalami dulu, <b>{{ nP[2] }}</b> penting, dan <b>{{ nP[3] }}</b> pelengkap.</p>

    <div class="bar">
      <div class="seg" role="group" aria-label="Tampilan">
        <button type="button" :class="{ on: mode === 'menu' }" :aria-pressed="String(mode === 'menu')" @click="mode = 'menu'">Per menu</button>
        <button type="button" :class="{ on: mode === 'urut' }" :aria-pressed="String(mode === 'urut')" @click="mode = 'urut'">Urutan belajar</button>
      </div>
      <div v-if="mode === 'menu'" class="chips" role="group" aria-label="Pilih menu">
        <button type="button" :class="{ on: pilih === 'semua' }" :aria-pressed="String(pilih === 'semua')" @click="pilih = 'semua'">Semua</button>
        <button v-for="b in BAGIAN" :key="b.id" type="button" :class="{ on: pilih === b.id }" :aria-pressed="String(pilih === b.id)" @click="pilih = b.id">
          {{ b.menu }} <b>{{ b.kurang.length }}</b></button>
      </div>
    </div>

    <template v-if="mode === 'menu'">
      <article v-for="b in bagian" :key="b.id" class="menu">
        <header>
          <h2>{{ b.menu }}</h2>
          <RouterLink v-if="b.rute" class="small buka" :to="b.rute">Buka menu {{ b.menu }}</RouterLink>
        </header>
        <p class="inti">{{ b.inti }}</p>
        <p class="lbl">Sudah ada</p>
        <ul class="sudah"><li v-for="(x, i) in b.sudah" :key="i">{{ x }}</li></ul>
        <p class="lbl">Yang kurang dan perlu didalami</p>
        <div class="topik">
          <section v-for="k in b.kurang" :key="k.id" class="kartu">
            <div class="kepala">
              <span class="tag" :class="kelasP[k.prioritas]">{{ PRIORITAS[k.prioritas] }}</span>
              <h3>{{ k.judul }}</h3>
            </div>
            <p class="kenapa">{{ k.kenapa }}</p>
            <p class="baru"><b>Wawasan baru.</b> {{ k.wawasan }}</p>
            <details v-if="k.detail" class="dalam">
              <summary>Pelajari lebih dalam</summary>
              <p v-for="(x, i) in k.detail" :key="i">{{ x }}</p>
              <p v-if="k.contoh" class="contoh">{{ k.contoh }}</p>
              <template v-if="k.keliru?.length">
                <p class="lbl">Kesalahan umum</p>
                <ul class="pel keliru"><li v-for="(x, i) in k.keliru" :key="i">{{ x }}</li></ul>
              </template>
            </details>
            <p class="lbl">Yang dipelajari</p>
            <ul class="pel"><li v-for="(x, i) in k.pelajari" :key="i">{{ x }}</li></ul>
            <p class="small muted sumber">Sumber: {{ k.sumber.join(' · ') }}</p>
          </section>
        </div>
      </article>
    </template>

    <ol v-else class="urut">
      <li v-for="(k, i) in urutan" :key="k.id">
        <span class="no">{{ i + 1 }}</span>
        <div>
          <p class="baris"><b>{{ k.judul }}</b> <span class="tag" :class="kelasP[k.prioritas]">{{ PRIORITAS[k.prioritas] }}</span>
            <RouterLink v-if="k.rute" class="small buka" :to="k.rute">{{ k.menu }}</RouterLink><span v-else class="small muted">{{ k.menu }}</span></p>
          <p class="small">{{ k.wawasan }}</p>
        </div>
      </li>
    </ol>

    <p class="small muted">Bahan belajar, bukan saran investasi. Topik yang bersumber dari buku lanjutan Carney belum dirangkum di website; nomor pasal dan isi peraturan cek langsung ke dokumen resminya di ojk.go.id dan idx.co.id.</p>
  </section>
</template>

<style scoped>
.ww{display:flex;flex-direction:column;gap:14px}
.small{font-size:12px}.muted{color:var(--ink-2)}
.ket{margin:0;max-width:820px;line-height:1.55}
.ket b{font-family:var(--f-data)}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.seg{display:flex;border:1px solid var(--rule);border-radius:8px;overflow:hidden}
.seg button{border:0;background:var(--sheet);color:var(--ink-2);padding:5px 12px;cursor:pointer;font:600 13px var(--f-body)}
.seg button.on{background:var(--accent-soft);color:var(--accent)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips button{border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);border-radius:14px;padding:3px 11px;cursor:pointer;font:600 12px var(--f-body)}
.chips button.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.chips b{font-family:var(--f-data);margin-left:2px}
.menu{background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:14px 16px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:6px}
.menu header{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.menu h2{margin:0;font-size:19px}
.buka{color:var(--accent)}
.inti{margin:0;max-width:820px;line-height:1.55}
.lbl{margin:8px 0 2px;font-size:12px;font-weight:700;color:var(--ink-2)}
.sudah{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.sudah li{font-size:12px;padding:2px 9px;border-radius:12px;background:var(--calm-bg);color:var(--calm)}
.topik{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px}
.kartu{border:1px solid var(--rule-2);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.kepala{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.kepala h3{margin:0;font-size:15px;line-height:1.35}
.kenapa,.baru{margin:0;font-size:13.5px;line-height:1.5}
.kenapa{color:var(--ink-2)}
.baru{background:var(--accent-soft);border-radius:6px;padding:7px 10px;margin-top:4px}
.baru b{color:var(--accent)}
.pel{margin:0;padding-left:18px;font-size:13px;line-height:1.5;display:grid;gap:2px}
.sumber{margin:6px 0 0}
.dalam{font-size:13.5px;line-height:1.55;border-top:1px dashed var(--rule-2);padding-top:6px;margin-top:4px}
.dalam summary{cursor:pointer;font-weight:700;color:var(--accent);font-size:13px}
.dalam p{margin:6px 0 0}
.contoh{background:var(--sheet-2);border-left:3px solid var(--accent);padding:6px 10px;border-radius:0 6px 6px 0}
.keliru li::marker{color:var(--strong)}
.urut{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.urut li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;background:var(--sheet);border:1px solid var(--rule);border-radius:8px;padding:10px 14px}
.urut p{margin:0}
.baris{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}
.no{width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font:700 13px var(--f-data)}
@media (max-width: 760px){.topik{grid-template-columns:1fr}}
</style>
