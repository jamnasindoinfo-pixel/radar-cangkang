import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'monitor', component: () => import('./views/MonitorView.vue') },
    { path: '/kandidat', name: 'kandidat', component: () => import('./views/KandidatView.vue') },
    { path: '/berita', name: 'berita', component: () => import('./views/BeritaView.vue') },
    // Intel Pasar dihapus (sumber tradersaham tidak tersedia); tautan lama diarahkan ke Monitor.
    { path: '/intel', redirect: '/' },
    // POV kini tab di halaman IHSG; tautan lama diarahkan ke sana.
    { path: '/pov', redirect: { path: '/seasonality', query: { tab: 'pov' } } },
    { path: '/harmonic', name: 'harmonic', component: () => import('./views/HarmonicView.vue') },
    { path: '/rekomendasi', name: 'rekomendasi', component: () => import('./views/RekomendasiView.vue') },
    { path: '/seasonality', name: 'seasonality', component: () => import('./views/SeasonalityView.vue') },
    { path: '/bandingkan', name: 'bandingkan', component: () => import('./views/CompareView.vue') },
    { path: '/emiten/:ticker', name: 'emiten', component: () => import('./views/EmitenView.vue'), props: true },
    // Tautan lama versi vanilla (#update, #progress, #potensi, #story); #analisa dan lainnya jatuh ke catch-all.
    { path: '/update', redirect: '/berita' },
    ...['progress', 'potensi', 'story'].map(set => ({ path: '/' + set, redirect: { path: '/', query: { set } } })),
    { path: '/:rest(.*)', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// Setelah build baru, tab lama masih memegang nama chunk lama: muat ulang sekali.
router.onError((err, to) => {
  if (/dynamically imported module|Importing a module script failed/.test(String(err?.message))) {
    location.hash = to.fullPath
    location.reload()
  }
})
