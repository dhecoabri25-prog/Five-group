# Five Group — Website Company Profile + Sistem Pesanan

Website Five Group lengkap dengan front-end (HTML/CSS/JS murni) dan back-end
(Node.js dengan database SQLite sungguhan, semuanya modul bawaan Node.js —
tidak perlu `npm install`).

## Struktur folder

```
five-group/
├── server.js              # backend: server statis + REST API + database
├── package.json
├── data/
│   └── fivegroup.db        # database SQLite, dibuat & diisi otomatis
└── public/
    ├── index.html           # halaman utama
    ├── admin.html           # panel admin (pesanan, produk, pesan)
    ├── css/style.css
    └── js/main.js
```

## Menjalankan

Butuh **Node.js versi 22 ke atas** (karena memakai modul bawaan `node:sqlite`).
Tidak ada dependency yang perlu di-install.

```bash
cd five-group
node server.js
```

Lalu buka `http://localhost:3000` di browser.

Untuk mengganti port atau kunci admin:

```bash
PORT=8080 ADMIN_KEY=kunci-rahasia node server.js
```

Kunci admin default (jika tidak diset): `fivegroup-admin`

## Database

Data tersimpan permanen di `data/fivegroup.db` (SQLite, satu file, tidak perlu
server database terpisah). Tabel yang dipakai:

| Tabel      | Isi                                                            |
|------------|-------------------------------------------------------------------|
| `products` | Katalog produk (nama, harga, kategori, status aktif)             |
| `team`     | Profil koordinator pelaksana (nama, jabatan, tugas, foto)        |
| `orders`   | Pesanan masuk dari pelanggan (produk, jumlah, total, status)     |
| `messages` | Pesan dari formulir kontak                                       |
| `settings` | Data kecil seperti penghitung kunjungan                          |

Saat pertama kali dijalankan, tabel `products` otomatis diisi 3 produk awal:
Kerupuk Kuah Mie, Es Nutrisari Susu, dan Paket Hemat — sesuai katalog usaha
saat ini. Produk baru bisa ditambah lewat panel admin.

## Fitur back-end (REST API)

**Publik:**
| Method | Endpoint         | Keterangan                          |
|--------|------------------|----------------------------------------|
| GET    | `/api/products`  | Daftar produk aktif untuk ditampilkan  |
| POST   | `/api/orders`    | Membuat pesanan baru                   |
| POST   | `/api/contact`   | Mengirim pesan dari formulir kontak    |
| POST   | `/api/visits`    | Menambah & mengembalikan jumlah kunjungan |

**Admin** (butuh `?key=ADMIN_KEY`):
| Method | Endpoint                | Keterangan                        |
|--------|--------------------------|--------------------------------------|
| GET    | `/api/orders`            | Semua pesanan                       |
| PATCH  | `/api/orders/:id`        | Ubah status pesanan                 |
| GET    | `/api/products/admin`    | Semua produk (termasuk nonaktif)    |
| POST   | `/api/products`          | Tambah produk baru                  |
| PATCH  | `/api/products/:id`      | Ubah produk / aktif-nonaktifkan     |
| DELETE | `/api/products/:id`      | Hapus produk                        |
| GET    | `/api/team/admin`        | Semua koordinator (termasuk nonaktif) |
| POST   | `/api/team`              | Tambah koordinator baru             |
| PATCH  | `/api/team/:id`          | Ubah data koordinator / aktif-nonaktifkan |
| DELETE | `/api/team/:id`          | Hapus koordinator                   |
| GET    | `/api/messages`          | Semua pesan kontak                  |
| GET    | `/api/stats`             | Ringkasan statistik usaha           |

## Panel admin

Buka `http://localhost:3000/admin.html`, masukkan admin key, lalu **Masuk**.
Tersedia 3 tab:
- **Pesanan** — lihat semua pesanan masuk & ubah statusnya (Baru → Diproses →
  Selesai / Dibatalkan) langsung dari dropdown.
- **Produk** — tambah produk baru, aktifkan/nonaktifkan, atau hapus produk.
- **Tim** — tambah profil koordinator pelaksana (nama, jabatan, tugas, dan
  foto langsung dari galeri HP — otomatis dikompres jadi bagian dari database,
  maksimal ukuran file 2MB per foto).
- **Pesan Kontak** — lihat semua pesan dari formulir kontak di halaman utama.

Kartu statistik di atas menampilkan total kunjungan, total pesanan, pesanan
yang masih baru, total omzet, jumlah pesan masuk, dan jumlah produk aktif.

## Fitur front-end

- Satu halaman panjang: Hero, Tentang, Perjalanan (timeline), Visi & Misi,
  **Produk** (dimuat langsung dari database), Nilai (Innovation, Quality,
  Integrity, Growth, Togetherness), **Koordinator Pelaksana** (profil tim,
  dimuat dari database), Komitmen, Rencana Masa Depan, Kontak.
- **Katalog produk dinamis** — kartu produk dibuat otomatis dari isi database,
  jadi kalau admin menambah/menghapus produk, tampilan di halaman utama
  langsung berubah tanpa mengedit HTML.
- **Formulir pemesanan (modal)** — klik "Pesan sekarang" pada produk apa pun
  untuk membuka form pemesanan (jumlah, nama, nomor WhatsApp, catatan).
  Pesanan langsung tersimpan ke database dan muncul di panel admin.
- **Integrasi WhatsApp** — tombol "Chat WhatsApp" di tiap produk, tombol
  WhatsApp mengambang di pojok layar, dan link konfirmasi otomatis setelah
  memesan — semuanya membuka WhatsApp dengan pesan yang sudah terisi.
- Animasi ringan: grafik pertumbuhan yang menggambar sendiri di hero, garis
  timeline yang terisi mengikuti scroll, reveal halus saat section muncul,
  angka statistik yang menghitung naik — semua menghormati pengaturan
  `prefers-reduced-motion` pengguna.
- Formulir kontak & penghitung pengunjung tersimpan ke database.
- Responsif penuh dari mobile hingga desktop.

## Kustomisasi

- **Nomor WhatsApp**: ganti `WHATSAPP_NUMBER` di baris awal
  `public/js/main.js` dengan nomor bisnis (format: kode negara tanpa `+`,
  contoh `6281234567890`).
- **Teks & konten**: edit langsung di `public/index.html`.
- **Warna & tipografi**: ubah custom properties di `:root { ... }` pada
  `public/css/style.css`.
- **Produk**: tidak perlu edit kode — tambah/ubah/hapus lewat panel admin,
  otomatis tersimpan di database dan langsung tampil di halaman utama.
- **Koordinator pelaksana**: sama seperti produk — tambah nama, jabatan,
  tugas, dan foto langsung lewat panel admin (tab **Tim**). Kalau foto belum
  diunggah, kartu profil otomatis menampilkan inisial nama sebagai pengganti.
