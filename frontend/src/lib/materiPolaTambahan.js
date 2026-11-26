// Slide "Pola tambahan" tab Materi: pola di luar Harmonic Trading Vol. 1 yang tetap dideteksi halaman ini (Alternate
// Bat, Shark, 5-0, Three Drives) serta AB=CD sebagai pola mandiri. Bentuk pola dari lembar pola yang dilampirkan
// pengguna; rasio mengikuti materi (Carney Vol. 1 untuk AB=CD, lembar pola untuk pola lain). Skema slide: lihat
// harmonikMateri.js. Data murni.

export const POLA_TAMBAHAN = [
  {
    id: 'pt-pengantar', bagian: 'Pembahasan Pola', judul: 'Pola tambahan di luar Vol. 1', sub: 'Dari lembar pola, tetap relevan untuk saham',
    paragraf: [
      'Selain lima pola utama Carney, lembar pola yang dipakai banyak trader memuat Alternate Bat, Shark, 5-0, dan Three Drives. Pola-pola ini dikembangkan kemudian atau berasal dari tradisi analisa yang lebih tua, sehingga tidak dibahas di Harmonic Trading Vol. 1.',
      'Semua pola tersebut membaca struktur harga, bukan instrumen tertentu, sehingga dapat dipakai pada saham. Syaratnya sama dengan pola utama: saham likuid, candle harian atau mingguan, swing yang jelas, dan konfirmasi di titik akhir.',
    ],
    tabel: { kolom: ['Pola', 'Titik', 'Ciri utama', 'Sumber rasio'], baris: [
      ['Alternate Bat', '5 (X-A-B-C-D)', 'B dangkal, D melewati X sedikit (1,13 XA)', 'Lembar pola'],
      ['Shark', '5 (X-A-B-C-D)', 'C melewati A, D kembali ke sekitar X', 'Lembar pola'],
      ['5-0', '5 (X-A-B-C-D)', 'B melewati X, C melewati A, D di 0,50 BC', 'Lembar pola'],
      ['Three Drives', '6 (0-1-A-2-B-3)', 'Tiga dorongan searah; dorongan ketiga di 1,27 atau 1,618', 'Lembar pola'],
      ['AB=CD mandiri', '4 (A-B-C-D)', 'Kaki CD setara atau 1,27–1,618 kali AB', 'Carney, Bab 4'],
    ] },
  },
  {
    id: 'pt-altbat', bagian: 'Pembahasan Pola', judul: 'Alternate Bat', sub: 'Koreksi dalam yang sedikit melewati titik awal',
    paragraf: [
      'Alternate Bat mirip Bat, tetapi titik B hanya dangkal di 0,382 XA dan titik D melewati X sampai 1,13 XA. Karena D melewati X, batas batalnya adalah sisi luar PRZ, bukan titik X.',
      'Di saham, pola ini sering tampak sebagai tembus semu (false break) di bawah support lama sebelum harga memantul, atau di atas resistance sebelum berbalik turun.',
    ],
    tabel: { kolom: ['Titik', 'Syarat'], baris: [['B', '0,382 XA'], ['C', '0,382–0,886 AB'], ['Proyeksi BC', '2,0–3,618'], ['D', '1,13 XA (melewati X)']] },
    pola: 'altbat', alat: 'xabcd', rujukan: 'Lembar pola harmonik',
  },
  {
    id: 'pt-shark', bagian: 'Pembahasan Pola', judul: 'Shark', sub: 'C melewati A, D kembali ke sekitar X',
    paragraf: [
      'Shark terbentuk setelah lonjakan tajam: titik C melewati A sejauh 1,13–1,618 kaki AB, lalu harga berbalik ke titik D di sekitar level X (0,886–1,13 kaki XC).',
      'Pola ini cocok untuk saham yang volatil dan sering bergerak berlebihan. Pembalikannya cepat, sehingga stop loss di luar PRZ perlu dipasang ketat.',
    ],
    tabel: { kolom: ['Titik', 'Syarat'], baris: [['B', '0,382–0,886 XA'], ['C', '1,13–1,618 AB (melewati A)'], ['Proyeksi BC', '1,618–2,24'], ['D', '0,886–1,13 kaki XC']] },
    pola: 'shark', alat: 'xabcd', rujukan: 'Lembar pola harmonik',
  },
  {
    id: 'pt-50', bagian: 'Pembahasan Pola', judul: '5-0', sub: 'Koreksi 50% setelah gerak berlebihan',
    paragraf: [
      'Pada 5-0, titik B melewati X (1,13–1,618 XA) dan titik C melewati A (1,618–2,24 AB). Titik D adalah retracement 0,50 kaki BC, tempat harga diperkirakan melanjutkan arah kaki BC.',
      'Pola ini sering muncul setelah pola harmonik lain gagal dan tren berbalik. Halaman ini memasang stop di retracement 0,618 kaki BC dan target di 0,618 kaki DC lalu titik C.',
    ],
    tabel: { kolom: ['Titik', 'Syarat'], baris: [['B', '1,13–1,618 XA (melewati X)'], ['C', '1,618–2,24 AB (melewati A)'], ['D', 'Retracement 0,50 kaki BC'], ['Stop / target', '0,618 BC / 0,618 DC lalu C']] },
    pola: 'fiveo', alat: 'xabcd', rujukan: 'Lembar pola harmonik',
  },
  {
    id: 'pt-3d', bagian: 'Pembahasan Pola', judul: 'Three Drives', sub: 'Tiga dorongan yang makin melelahkan tren',
    paragraf: [
      'Three Drives terdiri dari tiga dorongan searah (1, 2, 3) yang dipisahkan dua koreksi (A dan B). Dorongan kedua 1,27–1,618 kali koreksi A, dan dorongan ketiga selesai di salah satu level 1,27 atau 1,618 kali koreksi B. PRZ dibuat sempit di sekitar level itu supaya titik entry jelas. Setelah dorongan ketiga, tren diharapkan berbalik.',
      'Di saham, pola ini relevan pada kenaikan atau penurunan berjenjang yang mulai kehilangan tenaga. Konfirmasi volume dan candle pembalikan di dorongan ketiga penting, karena tren kuat bisa memberi dorongan keempat.',
    ],
    tabel: { kolom: ['Bagian', 'Syarat'], baris: [['Dorongan 2', '1,27–1,618 kali koreksi A'], ['Dorongan 3 (PRZ)', 'Level 1,27 atau 1,618 kali koreksi B, ±3% kaki koreksi'], ['Struktur', 'Puncak/lembah makin tinggi atau makin rendah'], ['Stop / target', 'Luar PRZ / 0,382 lalu 0,618 seluruh pola']] },
    pola: 'tigadorongan', rujukan: 'Lembar pola harmonik',
  },
  {
    id: 'pt-abcd', bagian: 'Pembahasan Pola', judul: 'AB=CD sebagai pola mandiri', sub: 'Pola paling dasar, juga dideteksi otomatis',
    paragraf: [
      'Halaman ini juga mendeteksi AB=CD tanpa titik X. PRZ adalah irisan antara panjang kaki CD (setara AB, atau 1,27–1,618 AB untuk Alternate AB=CD) dan proyeksi BC 1,13–2,618. AB=CD hanya ditampilkan setelah D sampai di PRZ, karena AB=CD yang belum selesai muncul di hampir semua saham.',
      'AB=CD paling sering muncul sehingga paling banyak sinyal palsu bila berdiri sendiri. Nilainya naik bila titik D bertemu angka lain, misalnya retracement XA dari pola lima titik atau support/resistance lama.',
    ],
    tabel: { kolom: ['Varian', 'Syarat kaki CD', 'Titik C', 'Proyeksi BC'], baris: [['AB=CD', 'Sama dengan AB', '0,382–0,886 AB', '1,13–2,618'], ['Alternate AB=CD', '1,27–1,618 kali AB', '0,382–0,886 AB', '1,13–2,618']] },
    pola: 'altabcd', alat: 'ext', rujukan: 'Carney, Bab 4',
  },
  {
    id: 'pt-relevansi', bagian: 'Pembahasan Pola', judul: 'Relevansi pola tambahan untuk saham BEI', sub: 'Kapan berguna dan apa yang perlu diwaspadai',
    tabel: { kolom: ['Pola', 'Sering muncul saat', 'Catatan untuk saham BEI'], baris: [
      ['AB=CD', 'Gerak lanjutan dalam tren', 'Paling sering; kuat bila bertemu level lain'],
      ['Alternate Bat', 'Uji ulang support/resistance yang sedikit tertembus', 'Waspadai false break di sekitar ARB/ARA'],
      ['Shark', 'Lonjakan tajam melewati swing sebelumnya', 'Saham volatil; stop ketat'],
      ['5-0', 'Setelah pola lain gagal dan tren berbalik', 'Jarang; butuh swing yang jelas'],
      ['Three Drives', 'Kenaikan/penurunan berjenjang yang melemah', 'Cek volume; tren kuat bisa lanjut ke dorongan keempat'],
    ] },
  },
]
