// Nama perusahaan semua saham dari /api/nama-saham (dimuat sekali per sesi), untuk ditampilkan di bawah kode saham.
import { reactive } from 'vue'
import { api } from '../api.js'

const peta = reactive({})
let dimuat = null
function muat() {
  if (!dimuat) dimuat = api.get('/api/nama-saham').then(r => { if (r && !r.error) Object.assign(peta, r) }).catch(() => { dimuat = null })
  return dimuat
}

// Nama perusahaan untuk kode saham ('' bila belum ada); memicu pemuatan pertama.
export function namaSaham(kode) {
  muat()
  return peta[kode] || ''
}
