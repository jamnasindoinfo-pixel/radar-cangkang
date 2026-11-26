import { describe, it, expect } from 'vitest'
import { lolosPerSektor, SEMUA } from '../kelompokLk.js'

const r = (t, sektor, pe, extra = {}) => ({ t, kelas: { sektor }, kuartal: { pe }, ...extra })

describe('lolosPerSektor', () => {
  it('mengelompokkan per sektor dan menggabungkan semua, urut PE terendah', () => {
    const rows = [r('AAAA', 'Energi', 6), r('BBBB', 'Energi', 3), r('CCCC', 'Kesehatan', 4),
      r('DDDD', 'Keuangan', 2, { kelas: { sektor: 'Keuangan', sub: 'Bank' } }), r('EEEE', 'Energi', 1), r('FFFF', 'Lainnya', 1)]
    const h = lolosPerSektor(rows, x => x.t === 'EEEE' ? ['PE negatif'] : [])
    expect(h.Energi.map(x => x.t)).toEqual(['BBBB', 'AAAA'])
    expect(h.Kesehatan.map(x => x.t)).toEqual(['CCCC'])
    expect(h.Keuangan).toBeUndefined()                       // bank dikecualikan
    expect(h[SEMUA].map(x => x.t)).toEqual(['BBBB', 'CCCC', 'AAAA'])   // sektor di luar daftar & yang gagal tidak ikut
  })
})
