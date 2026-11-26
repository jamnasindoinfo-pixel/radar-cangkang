import { describe, it, expect } from 'vitest'
import { scenesFor, insiderScenes, intelScenes, SLIDE_TABS } from '../slideTabs.js'

describe('slideTabs', () => {
  it('mengelompokkan adegan per tab sesuai urutan', () => {
    const all = [{ id: 'tesis' }, { id: 'buka' }, { id: 'skor' }, { id: 'penutup' }]
    expect(scenesFor('ringkasan', all).map(s => s.id)).toEqual(['buka', 'tesis', 'penutup'])
    expect(scenesFor('analisa', all).map(s => s.id)).toEqual(['skor'])
    expect(SLIDE_TABS).toContain('intel')
  })
  it('insider dan intel tanpa data tetap menghasilkan satu slide keterangan', () => {
    expect(insiderScenes([], 'ABCD')[0].id).toBe('insider-kosong')
    expect(intelScenes({ ada: false }, 'ABCD')[0].id).toBe('intel-kosong')
  })
})
