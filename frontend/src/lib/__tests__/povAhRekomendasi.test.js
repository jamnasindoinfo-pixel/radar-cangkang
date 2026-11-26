import { describe, expect, it } from 'vitest'
import { pilihRekomendasi } from '../povAh.js'

const b = (t, skor, ubah, x = {}) => ({ t, skor, ff: 20, dicek: true, notasi: [], tren: ubah == null ? null : { ubah }, ...x })

describe('pilihRekomendasi', () => {
  it('utamakan yang pemegangnya menyusut, urut skor lalu penyusutan', () => {
    const rows = [b('ASDM', 75, 0.9), b('AKSI', 77, -10.1), b('PGLI', 75, -5.5), b('LRNA', 75, -9.7), b('MERK', 73, -22.2), b('GDYR', 74, -5.1)]
    expect(pilihRekomendasi(rows, 5).map(r => r.t)).toEqual(['AKSI', 'LRNA', 'PGLI', 'GDYR', 'MERK'])
  })
  it('buang notasi, UMA, suspensi, status belum dicek, free float kosong; isi kekurangan dari baris bersih lain', () => {
    const rows = [b('AAAA', 90, -20, { notasi: [{ k: 'X' }] }), b('BBBB', 89, -20, { uma: true }), b('CCCC', 88, -20, { dicek: false }),
      b('DDDD', 87, -20, { ff: null }), b('EEEE', 86, -20, { suspen: true }), b('FFFF', 60, -6), b('GGGG', 80, 2), b('HHHH', 70, null)]
    expect(pilihRekomendasi(rows, 3).map(r => r.t)).toEqual(['FFFF', 'GGGG', 'HHHH'])
    expect(pilihRekomendasi(null)).toEqual([])
  })
})
