import { describe, it, expect } from 'vitest'
import { TINGKAT, PENGINGAT, buatSoal, soal, ulangSoal, rekap, rentang, lewatX } from '../harmonikQuiz.js'
import { POLA, STOP_PRZ } from '../harmonikAlat.js'

// rng berbiji supaya hasil acak bisa diulang.
const rngBiji = (s = 7) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }

describe('harmonikQuiz', () => {
  it('format angka memakai koma dan tanda pisah', () => {
    expect(rentang([0.618, 0.618])).toBe('0,618')
    expect(rentang([1.27, 1.414])).toBe('1,27–1,414')
  })

  it('setiap pola di tingkat punya pengingat', () => {
    for (const k of TINGKAT.semua.pola) expect(PENGINGAT[k]).toBeTruthy()
  })

  it('satu putaran berisi 10 soal valid tanpa pasangan kembar', () => {
    for (const t of ['utama', 'semua']) {
      const qs = buatSoal(rngBiji(3), t)
      expect(qs).toHaveLength(10)
      const kunci = new Set(qs.map(q => q.pola + q.jenis))
      expect(kunci.size).toBe(10)
      for (const q of qs) {
        expect(TINGKAT[t].pola).toContain(q.pola)
        expect(q.pilihan[q.benar]).toBeDefined()
        expect(new Set(q.pilihan).size).toBe(q.pilihan.length)
      }
    }
  })

  it('selalu 10 soal untuk banyak biji acak', () => {
    for (let s = 1; s < 300; s++) {
      expect(buatSoal(rngBiji(s), 'utama')).toHaveLength(10)
      expect(buatSoal(rngBiji(s), 'semua')).toHaveLength(10)
    }
  })

  it('pola tingkat utama tersebar rata', () => {
    const qs = buatSoal(rngBiji(11), 'utama')
    const per = {}
    for (const q of qs) per[q.pola] = (per[q.pola] || 0) + 1
    expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(3)
  })

  it('jawaban benar sesuai tabel POLA', () => {
    const pola = TINGKAT.semua.pola, rng = rngBiji(5)
    for (const k of pola) {
      const nama = soal(k, 'namaDariAngka', pola, rng)
      expect(nama.pilihan[nama.benar]).toBe(POLA[k].nama)
      expect(nama.tanya).toContain(rentang(POLA[k].d))
      const d = soal(k, 'dDariNama', pola, rng)
      expect(d.pilihan[d.benar]).toBe(rentang(POLA[k].d))
      const b = soal(k, 'bDariNama', pola, rng)
      expect(b.pilihan[b.benar]).toBe(rentang(POLA[k].b))
      const x = soal(k, 'lewatX', pola, rng)
      expect(x.benar).toBe(['gartley', 'bat'].includes(k) ? 0 : 1)
      const s = soal(k, 'stop', pola, rng)
      expect(s.benar).toBe(STOP_PRZ.has(k) ? 1 : 0)
    }
    expect(lewatX('gartley')).toBe(false)
    expect(lewatX('altbat')).toBe(true)
  })

  it('soal gambar menyembunyikan angka rasio', () => {
    const q = soal('crab', 'gambar', TINGKAT.utama.pola, rngBiji(2))
    expect(q.diagram.titik).toHaveLength(5)
    expect(q.diagram.garis.every(g => g.teks === '')).toBe(true)
    expect(q.pilihan[q.benar]).toBe('Crab')
  })

  it('pengecoh D tidak kembar walau Crab dan Deep Crab sama-sama 1,618', () => {
    const q = soal('deepcrab', 'dDariNama', TINGKAT.semua.pola, rngBiji(9))
    expect(q.pilihan.filter(p => p === '1,618')).toHaveLength(1)
  })

  it('ulang soal memakai pola dan jenis yang sama', () => {
    const salah = buatSoal(rngBiji(4), 'utama').slice(0, 3)
    const ulang = ulangSoal(salah, rngBiji(8), 'utama')
    expect(ulang.map(q => q.pola + q.jenis).sort()).toEqual(salah.map(q => q.pola + q.jenis).sort())
  })

  it('rekap menghitung nilai dan pola terlemah', () => {
    const r = rekap([
      { pola: 'bat', tepat: false }, { pola: 'bat', tepat: false },
      { pola: 'crab', tepat: false }, { pola: 'gartley', tepat: true },
    ])
    expect(r).toMatchObject({ benar: 1, total: 4, persen: 25 })
    expect(r.lemah[0]).toEqual({ k: 'bat', nama: 'Bat', n: 2 })
    expect(rekap([]).persen).toBe(0)
  })
})
