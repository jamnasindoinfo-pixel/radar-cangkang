import { describe, expect, it } from 'vitest'
import { analisaInsider, gerakPihak, kunciNama, pemegangBaru } from '../insiderAnalisa.js'

const kini = new Date('2026-11-18')
const r = (date, name, prev, cur, extra = {}) => ({ date, name, prev, cur, chg: cur - prev, source: 'KSEI', ...extra })
// Mirip NAYZ November 2026: Saiko menyelesaikan tender wajib 193,93 jt lembar (7,61%), lalu WISE TEAM tercatat
// 0% -> 7,57% (193,03 jt lembar) di KSEI lewat broker KI, broker yang juga dipakai Saiko.
const rows = [
  r('2026-08-19', 'SAIKO CONSULTANCY', 14.71, 29.41, { source: 'IDX' }),
  r('2026-08-19', 'SAIKO CONSULTANCY', 0, 14.71, { source: 'IDX' }),
  r('2026-08-19', 'SAIKO CONSULTANCY', 0, 29.41, { broker: 'KI' }),
  r('2026-08-19', 'ASIA INTRAINVESTA', 42.39, 27.69, { source: 'IDX' }),
  r('2026-08-19', 'ASIA INTRAINVESTA', 57.1, 42.39, { source: 'IDX' }),
  r('2026-08-19', 'ASIA INTRAINVESTA', 57.1, 27.69),
  r('2026-10-15', 'ASIA INTRAINVESTA', 20.36, 19.27),
  r('2026-11-10', 'SAIKO CONSULTANCY', 29.41, 7.61, { curShares: 193933300, broker: 'KI' }),
  r('2026-11-17', 'WISE TEAM', 0, 7.57, { curShares: 193033300, chgShares: 193033300, price: 58, estPrice: true, value: 11195931400, broker: 'KI', foreign: true }),
]
const aksi = [{ date: '2026-11-13', judul: 'Laporan Hasil Penawaran Tender Wajib', inti: 'Saiko membeli 193,93 juta saham atau 7,61% melalui penawaran tender wajib' }]

describe('pemegangBaru', () => {
  it('menemukan pemegang baru >=5% beserta petunjuk broker sama dan lembar mirip', () => {
    const [b, ...lain] = pemegangBaru(rows, { kini, aksi })
    expect(lain).toEqual([])
    expect(b).toMatchObject({ nama: 'WISE TEAM', cur: 7.57, lembar: 193033300, broker: 'KI', asing: true, terverifikasi: false })
    expect(b.tafsir).toMatch(/saham warkat ke scripless/)
    expect(b.brokerSama).toEqual(['SAIKO CONSULTANCY'])
    expect(b.mirip[0]).toMatchObject({ nama: 'SAIKO CONSULTANCY', lembar: 193933300, jenis: 'porsi' })
    expect(b.aksiMirip[0].date).toBe('2026-11-13')
  })
  it('keterbukaan IDX pihak yang sama dalam 10 hari menandai terverifikasi', () => {
    const [b] = pemegangBaru([...rows, r('2026-11-20', 'Wise Team Ltd', 0, 7.57, { source: 'IDX' })], { kini: new Date('2026-11-21') })
    expect(b.terverifikasi).toBe(true)
  })
  it('di luar rentang hari atau di bawah 5% tidak dihitung', () => {
    expect(pemegangBaru(rows, { kini: new Date('2027-06-01') })).toEqual([])
    expect(pemegangBaru([r('2026-11-17', 'KECIL', 0, 4.9)], { kini })).toEqual([])
  })
})

describe('gerakPihak', () => {
  it('memakai ujung rantai per tanggal, bukan menjumlah tiap baris', () => {
    const g = Object.fromEntries(gerakPihak(rows, { kini }).map(p => [p.nama, p]))
    expect(g['ASIA INTRAINVESTA'].ubah[180]).toBe(-37.83)
    expect(g['ASIA INTRAINVESTA'].kini).toBe(19.27)
    expect(g['SAIKO CONSULTANCY'].ubah[180]).toBe(7.61)   // baris KSEI per rekening terakhir (7,61%)
    expect(g['WISE TEAM'].ubah[30]).toBe(7.57)
  })
})

describe('analisaInsider', () => {
  it('menyusun kalimat ringkas dan daftar yang perlu dicek; menandai analisa mendalam yang lebih lama dari data', () => {
    const a = analisaInsider(rows, { dibuat: '2026-11-16 09:00', aksi, kepemilikan: { pemegang: [] } }, { kini })
    expect(a.kalimat[0]).toMatch(/WISE TEAM \(asing\) tercatat 0% → 7,57% pada 17 Nov 2026, 193,03 jt lembar/)
    expect(a.cek.some(c => /Broker KI juga dipakai SAIKO CONSULTANCY/.test(c))).toBe(true)
    expect(a.cek.some(c => /hampir sama dengan angka di keterbukaan 13 Nov 2026/.test(c))).toBe(true)
    expect(a.analisa.lama).toBe(true)
    expect(analisaInsider(rows, null, { kini }).analisa).toBe(null)
  })
  it('nama dicocokkan tanpa bentuk badan usaha', () => {
    expect(kunciNama('PT Asia Intrainvesta Tbk')).toBe(kunciNama('ASIA INTRAINVESTA'))
  })
})
