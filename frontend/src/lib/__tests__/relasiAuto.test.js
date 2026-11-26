import { describe, it, expect } from 'vitest'
import { buildRelasi } from '../relasiAuto.js'

const profil = { GPSO: {
  pengendali: [{ nama: 'Kurniawan Eddy Tjokro', peran: 'UBO', entitas: 'PT PIMSF Pulogadung (Tjokro Group)', porsi: '42,40% (KSEI)' }],
  pengurus: { direksi: [{ nama: 'Axel', jabatan: 'Direktur', orangPengendaliBaru: true }], komisaris: [] },
  afiliasi: { pihakLawan: 'PT Jaya Indah Casting (JIC) — penjual tanah', hubungan: 'Afiliasi langsung (satu grup)' },
  ringkas: 'GPSO dikendalikan Tjokro Group.', tidakDitemukan: ['Pendidikan Kurniawan Eddy Tjokro'],
} }
const aset = { GPSO: { aset: { nama: 'Aset tetap PT Jaya Indah Casting', sektor: 'properti' }, kjpp: { status: 'terbit' }, transaksi: { nilai: 'Rp78,5 miliar' } } }

describe('buildRelasi', () => {
  it('membangun orang → kendaraan → emiten, pihak lawan terafiliasi, aset, dan publik', () => {
    const r = buildRelasi('GPSO', { profil, aset, pandangan: { dilusi: { porsiPublikSekarang: 57.6 } } })
    const ids = r.nodes.map(n => n.id)
    expect(ids).toEqual(expect.arrayContaining(['p0', 'e0', 'em', 'lawan', 'aset', 'pub']))
    expect(r.nodes.find(n => n.id === 'em').x).toBe(680)
    expect(r.nodes.find(n => n.id === 'e0').t).toBe('PT PIMSF Pulogadung')
    expect(r.edges).toContainEqual(['p0', 'e0', 'own', 'UBO 42,40%'])
    expect(r.edges).toContainEqual(['e0', 'lawan', 'role', 'afiliasi'])
    expect(r.edges).toContainEqual(['aset', 'em', 'plan', 'Rp78,5 miliar'])
    expect(r.info.p0.open).toEqual(['Pendidikan Kurniawan Eddy Tjokro'])
    // tiap node punya posisi
    expect(r.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true)
  })

  it('tanpa data pengendali sama sekali → null', () => {
    expect(buildRelasi('ZZZZ', {})).toBe(null)
  })

  it('"tidak terafiliasi" tidak ditandai afiliasi', () => {
    const p = { X: { pengendali: [{ nama: 'A', peran: 'UBO', entitas: 'PT B' }], afiliasi: { pihakLawan: 'PT C', hubungan: 'Dinyatakan tidak terafiliasi' } } }
    const r = buildRelasi('X', { profil: p })
    expect(r.edges.some(e => e[3] === 'afiliasi')).toBe(false)
  })
})

describe('buildRelasi aset', () => {
  const p = { X: { pengendali: [{ nama: 'A', peran: 'UBO', entitas: 'PT B' }] } }
  it('target injeksi dari story-verified bila aset-verified kosong', () => {
    const r = buildRelasi('X', { profil: p, verified: { X: { injectTarget: 'PT Tambang C (60%)', injectType: 'Inbreng', nominal: 'Rp1 T' } } })
    expect(r.nodes.find(n => n.id === 'aset').t).toBe('PT Tambang C')
    expect(r.edges).toContainEqual(['aset', 'em', 'plan', 'Rp1 T'])
  })
  it('tanpa injeksi: kotak keterangan tanpa garis', () => {
    const r = buildRelasi('X', { profil: p, verified: { X: { baru: 'Tetap: logistik' } } })
    const a = r.nodes.find(n => n.id === 'aset')
    expect([a.t, a.s, a.k]).toEqual(['Tanpa injeksi aset', 'bisnis lama dipertahankan', 'none'])
    expect(r.edges.some(e => e[0] === 'aset')).toBe(false)
  })
})

describe('layoutRows', () => {
  it('memberi koordinat per baris, emiten di tengah baris 2', async () => {
    const { layoutRows } = await import('../relasiAuto.js')
    const r = layoutRows({ nodes: [{ id: 'a', row: 2 }, { id: 'em', row: 2 }, { id: 'b', row: 2 }, { id: 'p', row: 0 }] })
    expect(r.nodes.find(n => n.id === 'em').x).toBe(680)
    expect(r.nodes.find(n => n.id === 'p')).toMatchObject({ x: 680, y: 120 })
    expect(r.nodes.every(n => Number.isFinite(n.x))).toBe(true)
  })
  it('baris lebih dari 5 kotak dipecah jadi sub-baris', async () => {
    const { layoutRows } = await import('../relasiAuto.js')
    const people = Array.from({ length: 7 }, (_, i) => ({ id: 'p' + i, row: 0 }))
    const r = layoutRows({ nodes: [...people, { id: 'em', row: 2 }, { id: 'x', row: 1 }] })
    const ys = [...new Set(r.nodes.filter(n => n.row === 0).map(n => n.y))]
    expect(ys).toHaveLength(2)
    expect(r.nodes.filter(n => n.y === ys[0])).toHaveLength(5)
    // baris berikutnya turun mengikuti jumlah sub-baris
    expect(r.nodes.find(n => n.id === 'x').y).toBeGreaterThan(ys[1])
    expect(r.nodes.find(n => n.id === 'em').x).toBe(680)
  })
  it('relasi yang sudah berkoordinat tidak diubah', async () => {
    const { layoutRows } = await import('../relasiAuto.js')
    const rel = { nodes: [{ id: 'em', x: 10, y: 20 }] }
    expect(layoutRows(rel)).toBe(rel)
  })
})

describe('jaringan lintas emiten', () => {
  it('nama pihak dicocokkan tanpa bentuk badan hukum', async () => {
    const { buildEntityIndex, entityKey } = await import('../relasiAuto.js')
    const idx = buildEntityIndex({
      MEJA: { nodes: [{ id: 'em', t: 'MEJA' }, { id: 'a', t: 'PT Triple Berkah Bersama' }] },
      EPAC: { nodes: [{ id: 'b', t: 'Triple Berkah Bersama' }, { id: 'p', t: 'Masyarakat' }] },
    })
    expect([...idx.get(entityKey('PT. Triple Berkah Bersama'))].sort()).toEqual(['EPAC', 'MEJA'])
    expect(idx.has('masyarakat')).toBe(false)
  })
})

describe('lensa alur saham', () => {
  const rel = {
    nodes: [
      { id: 'p', row: 0, l: ['kendali', 'pengurus'], x: 1, y: 1 },
      { id: 'd', row: 0, l: ['pengurus'] },
      { id: 'em', row: 2 },
      { id: 'x', row: 3 },
    ],
    edges: [['p', 'em', 'own', '35%'], ['p', 'em', 'role', 'Komut', ['pengurus']], ['d', 'em', 'role', 'Dirut'], ['x', 'em', 'own', '1%']],
    transfers: [{ dari: 'a', ke: 'p' }, { dari: 'p', ke: 'b' }, { dari: 'a', ke: 'b' }],
  }

  it('memilah node per lensa, emiten selalu tampil, node tanpa lensa hanya di Semua', async () => {
    const { lensOf } = await import('../relasiAuto.js')
    const k = lensOf(rel, 'kendali')
    expect(k.nodes.map(n => n.id)).toEqual(['p', 'em'])
    // garis berlabel lensa lain disaring walau kedua ujungnya tampil
    expect(k.edges).toEqual([['p', 'em', 'own', '35%']])
    expect(lensOf(rel, 'pengurus').edges).toHaveLength(3)
    expect(lensOf(rel, 'semua')).toBe(rel)
  })

  it('menata ulang subset (koordinat lama dibuang)', async () => {
    const { lensOf } = await import('../relasiAuto.js')
    const p = lensOf(rel, 'kendali').nodes.find(n => n.id === 'p')
    expect(p.x).not.toBe(1)
    expect(Number.isFinite(p.y)).toBe(true)
  })

  it('daftar lensa hanya yang dipakai data; transfer disaring per node', async () => {
    const { lensesOf, transfersOf } = await import('../relasiAuto.js')
    expect(lensesOf(rel).map(([k]) => k)).toEqual(['kendali', 'pengurus'])
    expect(lensesOf({ nodes: [{ id: 'em' }] })).toEqual([])
    expect(transfersOf(rel, 'p')).toHaveLength(2)
    expect(transfersOf(rel, null)).toHaveLength(3)
  })
})

describe('tata letak per lensa', () => {
  it('baris bisa dipindah per lensa lewat lr', async () => {
    const { lensOf } = await import('../relasiAuto.js')
    const rel = { nodes: [{ id: 'a', row: 0, l: ['x'], lr: { x: 3 } }, { id: 'em', row: 2 }], edges: [] }
    expect(lensOf(rel, 'x').nodes.find(n => n.id === 'a').row).toBe(3)
  })

  it('menyimpan posisi tiap lensa di objek yang sama tanpa saling menimpa', async () => {
    const { layoutFor, mergeLayout } = await import('../relasiAuto.js')
    let s = mergeLayout({}, 'semua', { a: { x: 1, y: 1 } })
    s = mergeLayout(s, 'arus', { a: { x: 2, y: 2 } })
    expect(layoutFor(s, 'semua')).toEqual({ a: { x: 1, y: 1 } })
    expect(layoutFor(s, 'arus')).toEqual({ a: { x: 2, y: 2 } })
    // atur ulang satu lensa tidak menghapus lensa lain
    s = mergeLayout(s, 'arus', {})
    expect(s).toEqual({ a: { x: 1, y: 1 } })
  })
})

describe('posisi manual per lensa', () => {
  it('memakai lp bila semua node lensa punya posisi', async () => {
    const { lensOf } = await import('../relasiAuto.js')
    const rel = { nodes: [{ id: 'a', row: 0, l: ['x'], lp: { x: [10, 20] } }, { id: 'em', row: 2, lp: { x: [30, 40] } }], edges: [] }
    expect(lensOf(rel, 'x').nodes.map(n => [n.x, n.y])).toEqual([[10, 20], [30, 40]])
  })
})
