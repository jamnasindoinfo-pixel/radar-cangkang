// Saham HSC (High Shareholding Concentration) dari hsc.json: konsentrasi kepemilikan tinggi, dikeluarkan dari IHSG.
// Saringan dipakai bersama oleh Seasonality dan Pola Broker: '' = semua, 'tanpa' = buang HSC, 'hanya' = hanya HSC.
import { store } from '../store.js'

export const HSC_OPSI = [['', 'Semua'], ['tanpa', 'Tanpa HSC'], ['hanya', 'Hanya HSC']]
export const isHsc = t => (store.hsc?.kode || []).includes(t)
export const lolosHsc = (t, mode) => !mode || (mode === 'hanya') === isHsc(t)
export const hscInfo = () => store.hsc?.berlaku
  ? `${store.hsc.kode.length} saham HSC dikeluarkan dari perhitungan IHSG mulai ${store.hsc.berlaku} (sumber: ${store.hsc.sumber}).`
  : `${(store.hsc?.kode || []).length} saham HSC (konsentrasi kepemilikan tinggi) dikeluarkan dari perhitungan IHSG.`
