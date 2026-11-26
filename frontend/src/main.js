import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.js'
import { init } from './store.js'
import './tokens.css'

// Setelah situs diperbarui, berkas JS lama (nama berhash) dihapus; halaman yang masih terbuka gagal memuat modul
// (mis. PDF). Muat ulang sekali agar memakai versi terbaru.
window.addEventListener('vite:preloadError', e => {
  try {
    if (sessionStorage.getItem('muatUlangVersi')) return
    sessionStorage.setItem('muatUlangVersi', '1')
  } catch { /* penyimpanan tidak tersedia: tetap muat ulang */ }
  e.preventDefault()
  location.reload()
})
setTimeout(() => { try { sessionStorage.removeItem('muatUlangVersi') } catch { /* abaikan */ } }, 10000)

createApp(App).use(router).mount('#app')
init()
