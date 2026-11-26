// Harga semua saham dari /api/harga-saham (dimuat sekali per sesi): satu sumber & format harga yang sama
// untuk tab HSC, Pola Broker, Recovery, dan Low.
import { reactive } from 'vue'
import { api } from '../api.js'

const peta = reactive({})
let dimuat = null
function muat() {
  if (!dimuat) dimuat = api.get('/api/harga-saham').then(r => { if (r && !r.error) Object.assign(peta, r) }).catch(() => { dimuat = null })
  return dimuat
}

// {h, d, w, m, y, tgl} untuk kode saham (null bila belum ada); memicu pemuatan pertama.
export function hargaSaham(kode) {
  muat()
  return peta[kode] || null
}
