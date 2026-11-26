import { describe, it, expect } from 'vitest'
import { kelompokAudit } from '../auditMonitor.js'

describe('kelompokAudit', () => {
  it('dikelompokkan per emiten, temuan terberat di atas', () => {
    const g = kelompokAudit([
      { t: 'TGUK', jenis: 'catatan_usang' }, { t: 'TGUK', jenis: 'to_belum' },
      { t: 'KDTN', jenis: 'batal' }, { t: 'ULTJ', jenis: 'pengendali_belum' }, { t: 'AKRA', jenis: 'rencana_belum' },
    ])
    expect(g.map(x => [x.t, x.tingkat])).toEqual([['KDTN', 'strong'], ['TGUK', 'warn'], ['ULTJ', 'warn'], ['AKRA', 'calm']])
    expect(g[1].temuan.map(x => x.jenis)).toEqual(['to_belum', 'catatan_usang'])
  })
  it('data kosong atau rusak', () => {
    expect(kelompokAudit(null)).toEqual([])
    expect(kelompokAudit([{ jenis: 'batal' }, { t: 'XXXX', jenis: 'baru' }])).toEqual([{ t: 'XXXX', tingkat: 'calm', temuan: [{ t: 'XXXX', jenis: 'baru', tingkat: 'calm' }] }])
  })
})
