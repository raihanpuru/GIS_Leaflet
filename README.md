# 🗺️ Leaflet Pelanggan GIS — MySQL Edition

Aplikasi web GIS berbasis **Leaflet.js** untuk visualisasi dan manajemen data pelanggan secara geografis, dengan backend **Node.js (Express)** dan database **MySQL / MariaDB**. Proyek ini merupakan konversi dari versi PostgreSQL + PostGIS ke MySQL.

> Repositori: [raihanpuru/GIS_Leaflet](https://github.com/raihanpuru/GIS_Leaflet)

---

## 📋 Daftar Isi

- [Fitur](#-fitur)
- [Tech Stack](#-tech-stack)
- [Struktur Proyek](#-struktur-proyek)
- [Prasyarat](#-prasyarat)
- [Instalasi](#-instalasi)
- [Setup Database](#-setup-database)
- [Import Data](#-import-data)
- [Menjalankan Aplikasi](#-menjalankan-aplikasi)
- [API Endpoints](#-api-endpoints)
- [Cara Penggunaan](#-cara-penggunaan)
- [Changelog](#-changelog)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Fitur

- 🗺️ **Peta interaktif** berbasis Leaflet.js dengan basemap OpenStreetMap
- 📍 **Visualisasi marker pelanggan** dengan clustering otomatis
- 🏘️ **Layer polygon & bangunan** dari data OpenStreetMap (OSM) per kecamatan
- 🔍 **Filter multi-dimensi**: periode (bulan/tahun), alamat, blok, kategori (usage & status lunas)
- 📥 **Export CSV** sesuai filter yang sedang aktif
- ✏️ **Edit koordinat** via drag & drop marker — tersimpan otomatis ke database
- 🏗️ **Viewport rendering** untuk performa optimal (building hanya dirender di area yang terlihat)
- 🗜️ **Gzip compression** untuk mempercepat load halaman
- 🩺 **Health check endpoint** (`/api/health`) dan script `test-connection.js`

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | HTML, CSS, JavaScript (ES Modules), Leaflet.js |
| Backend | Node.js, Express.js |
| Database | MySQL 8.0+ / MariaDB 10.5+ |
| Dependencies | `express`, `mysql2`, `compression`, `cors`, `dotenv`, `csv-parser` |
| Dev | `nodemon` |

---

## 📁 Struktur Proyek

```
00_Tes Leaflet_mysql/
│
├── database/
│   ├── mysql_schema.sql            # Schema utama: tabel pelanggan, buildings, trigger, view
│   └── bangunan_schema.sql         # Schema tabel bangunan (footprint OSM)
│
├── server/
│   ├── index.js                    # Entry point Express server
│   ├── config/
│   │   └── database.js             # Konfigurasi koneksi MySQL pool
│   ├── models/
│   │   └── Pelanggan.js            # Model query database pelanggan
│   ├── routes/
│   │   ├── pelanggan.js            # Route API /api/pelanggan
│   │   └── bangunan.js             # Route API /api/bangunan
│   ├── scripts/
│   │   ├── import-csv.js           # Script import data pelanggan dari CSV
│   │   ├── import-latlong.js       # Script update koordinat pelanggan dari CSV
│   │   └── import-geojson.js       # Script import data bangunan dari GeoJSON (OSM)
│   └── test-connection.js          # Script verifikasi koneksi & tabel DB
│
├── public/
│   ├── index.html                  # Halaman utama aplikasi
│   ├── data/
│   │   └── kecamatan/              # (Opsional) file GeoJSON statis per kecamatan
│   ├── scripts/
│   │   ├── api/
│   │   │   └── pelanggan-api.js          # API client (fetch ke backend)
│   │   ├── app/
│   │   │   └── app.js                    # Inisialisasi aplikasi
│   │   ├── components/
│   │   │   ├── pelanggan-ui.js           # Marker, popup, legend pelanggan
│   │   │   ├── pelanggan-filter-ui.js    # Panel filter alamat & blok
│   │   │   ├── pelanggan-category-filter-ui.js
│   │   │   ├── pelanggan-period-filter-ui.js
│   │   │   └── polygon-ui.js             # Layer control & legend polygon
│   │   ├── pelanggan/
│   │   │   ├── pelanggan.js
│   │   │   ├── pelanggan-loader.js
│   │   │   ├── pelanggan-marker.js
│   │   │   ├── pelanggan-filter.js
│   │   │   ├── pelanggan-filter-render.js
│   │   │   ├── pelanggan-address-filter.js
│   │   │   ├── pelanggan-address-grouper.js
│   │   │   ├── pelanggan-category-filter.js
│   │   │   ├── pelanggan-csv.js
│   │   │   ├── pelanggan-layer-state.js
│   │   │   ├── pelanggan-store.js
│   │   │   └── building-pelanggan-matcher.js
│   │   ├── polygon/
│   │   │   ├── polygon.js
│   │   │   ├── polygon-processor.js
│   │   │   ├── kategori.js
│   │   │   └── kecamatan.js
│   │   └── utils/
│   │       ├── loading.js
│   │       └── viewport-manager.js
│   └── styles/
│       └── main.css
│
├── src/
│   └── server.js                   # Entry point alternatif (legacy)
│
├── Overpass-turbo (script bangunan).txt  # Query Overpass API untuk ambil data OSM
├── .env                            # Konfigurasi environment lokal (tidak di-commit)
├── .env.example                    # Template konfigurasi
├── package.json
└── README.md
```

---

## ✅ Prasyarat

- **Node.js** v14 atau lebih baru
- **npm** v6 atau lebih baru
- **MySQL** v8.0+ atau **MariaDB** v10.5+

---

## 🚀 Instalasi

### 1. Clone / Ekstrak Proyek

```bash
git clone https://github.com/raihanpuru/GIS_Leaflet.git
cd GIS_Leaflet
```

### 2. Install Dependensi Node.js

```bash
npm install
```

Ini akan menginstall semua package berikut secara otomatis:

| Package | Keterangan |
|---|---|
| `express` | Web framework / HTTP server |
| `mysql2` | Driver koneksi MySQL |
| `compression` | Gzip compression middleware |
| `cors` | Cross-Origin Resource Sharing |
| `dotenv` | Baca variabel dari file `.env` |
| `csv-parser` | Parse file CSV untuk import data |
| `nodemon` *(devDependency)* | Auto-restart server saat development |

### 3. Buat File Environment

```bash
cp .env.example .env
```

Edit file `.env` sesuai konfigurasi lokal:

```env
# Server
PORT=3000

# Database MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=leaflet_db
DB_USER=root
DB_PASSWORD=your_mysql_password

# Environment
NODE_ENV=development
```

> ⚠️ File `.env` sudah ada di `.gitignore`, jangan di-commit ke repositori.

---

## 🗄️ Setup Database

### 1. Buat Database

```bash
mysql -u root -p -e "CREATE DATABASE leaflet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2. Jalankan Schema Utama

```bash
mysql -u root -p leaflet_db < database/mysql_schema.sql
```

Schema ini membuat:
- Tabel **`pelanggan`** — data pelanggan beserta koordinat GPS dan info tagihan
- Tabel **`buildings`** — footprint bangunan dengan geometri poligon
- **Trigger** otomatis untuk mengisi kolom `POINT` dari `longitude` & `latitude`
- **View** `pelanggan_with_buildings` — join data pelanggan dan bangunan

### 3. Jalankan Schema Bangunan OSM

```bash
mysql -u root -p leaflet_db < database/bangunan_schema.sql
```

Membuat tabel **`bangunan`** untuk menyimpan footprint bangunan dari OpenStreetMap.

### 4. Verifikasi Koneksi & Tabel

```bash
npm run test:db
```

Output yang diharapkan:
```
✓ Connected successfully
✓ Spatial functions OK
✓ Pelanggan table exists
✅ All tests passed!
```

---

## 📥 Import Data

### Import Data Pelanggan (CSV)

Letakkan file CSV di folder `public/data/pelanggan/`, lalu jalankan:

```bash
npm run import
# atau dengan path kustom
node server/scripts/import-csv.js /path/to/file.csv
```

Format kolom CSV yang diharapkan:
```
nosambungan, idpelanggan, nopelanggan, nama, alamat, noalamat, nourut, Long, Lat
```

### Update Koordinat (Lat/Long) dari CSV

Jika hanya ingin memperbaiki koordinat pelanggan tanpa mengubah data lainnya, gunakan script khusus ini:

```bash
node server/scripts/import-latlong.js /path/to/file.csv
```

Format kolom CSV minimal yang dibutuhkan:
```
nopelanggan, Lat, Long
```

> Kolom lain di CSV akan diabaikan. Target update berdasarkan `nopelanggan` (unik). Semua periode (bulan/tahun) milik pelanggan tersebut akan diupdate sekaligus.

Alternatifnya, bisa juga langsung dari UI lewat tombol **Import Lat/Long** di peta (lihat [Cara Penggunaan](#️-cara-penggunaan)).

### Import Data Bangunan (GeoJSON dari OSM)

Data bangunan diambil dari OpenStreetMap menggunakan **Overpass API**. Query-nya sudah tersedia di file `Overpass-turbo (script bangunan).txt`.

Langkah:
1. Buka [overpass-turbo.eu](https://overpass-turbo.eu/)
2. Paste query dari file `.txt` tersebut, sesuaikan nama kecamatan
3. Jalankan dan export hasilnya sebagai **GeoJSON**
4. Import ke database:

```bash
node server/scripts/import-geojson.js
```

---

## ▶️ Menjalankan Aplikasi

### Mode Development (auto-reload dengan nodemon)

```bash
npm run dev
```

### Mode Production

```bash
npm start
```

Buka browser: **http://localhost:3000**

---

## 📡 API Endpoints

### Pelanggan

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/pelanggan` | Ambil semua pelanggan (support filter) |
| `GET` | `/api/pelanggan/search?q=<kata>` | Cari pelanggan berdasarkan nama/alamat |
| `GET` | `/api/pelanggan/nearby?lng=&lat=&radius=` | Pelanggan dalam radius tertentu (meter, default 500) |
| `GET` | `/api/pelanggan/stats` | Statistik data pelanggan |
| `GET` | `/api/pelanggan/:id` | Detail pelanggan by ID |
| `POST` | `/api/pelanggan` | Tambah pelanggan baru |
| `POST` | `/api/pelanggan/import-latlong` | Update koordinat massal dari data CSV |
| `PUT` | `/api/pelanggan/:id` | Update pelanggan by ID |
| `PATCH` | `/api/pelanggan/by-nosambungan/:nosambungan` | Update koordinat semua periode by nosambungan |
| `DELETE` | `/api/pelanggan/:id` | Hapus pelanggan |

**Query params** untuk `GET /api/pelanggan`:

| Param | Keterangan |
|---|---|
| `nama` | Filter by nama |
| `alamat` | Filter by alamat |
| `noalamat` | Filter by nomor alamat |
| `bulan` | Filter by bulan (1–12) |
| `tahun` | Filter by tahun |
| `limit` | Jumlah maksimal data |
| `offset` | Offset untuk pagination |
| `bbox` | Bounding box: `minLng,minLat,maxLng,maxLat` |

### Bangunan

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/bangunan/:kecamatan` | Data bangunan per kecamatan (GeoJSON FeatureCollection) |
| `GET` | `/api/bangunan/:kecamatan/stats` | Statistik jumlah bangunan per tipe |

**Query params** untuk `GET /api/bangunan/:kecamatan`:

| Param | Keterangan |
|---|---|
| `building` | Filter tipe bangunan (misal: `house`, `commercial`) |
| `amenity` | Filter amenity (misal: `school`, `clinic`) |
| `name` | Filter by nama bangunan (LIKE) |
| `bbox` | Bounding box: `minLng,minLat,maxLng,maxLat` |

### Lainnya

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/health` | Health check server |

---

## 🗺️ Cara Penggunaan

**Melihat Data Pelanggan** — marker otomatis muncul saat halaman dibuka. Klik marker untuk melihat detail di popup.

**Filter Data** — gunakan panel filter untuk menyaring berdasarkan periode, alamat, blok, atau kategori.

**Export CSV** — klik tombol **Save CSV** untuk mengunduh data sesuai filter yang aktif.

**Import Lat/Long** — klik tombol **Import Lat/Long**, pilih file CSV yang berisi kolom `nopelanggan`, `Lat`, `Long`. Koordinat akan diupdate langsung ke database tanpa perlu restart server.

**Edit Koordinat** — aktifkan mode Drag, geser marker ke posisi yang benar, koordinat tersimpan otomatis ke database.

**Layer Bangunan** — klik tombol Show Building untuk menampilkan/menyembunyikan footprint bangunan. Bangunan hanya dirender di viewport aktif untuk performa optimal.

---

## 🔄 Changelog

| Versi | Keterangan |
|---|---|
| **v2.5** | Fitur import Lat/Long dari CSV via UI |
| **v2.4** | Improvement + bugfix, fix count pelanggan |
| **v2.3** | Improvement + bugfix |
| **v2.2** | Improvement + bugfix |
| **v2.11** | Bug fix |
| **v2.1** | Optimasi load page + bugfix enable edit |
| **v2.01** | Optimasi first load web |
| **v2.0** | Optimasi first load halaman + gzip compression |
| **v1.9** | Fitur alamat group |
| **v1.8** | Bug fix |
| **v1.7** | UI & UX improvement |
| **v1.6** | Load data pelanggan by bulan + tahun |
| **v1.4** | Clustering marker pelanggan |
| **v1.3** | Download CSV sesuai filter aktif |
| **v1.x** | Refactor: gabung filter alamat & blok jadi 1 panel |
| **v1.0** | Initial commit |

---

## 🔧 Troubleshooting

**Error "request entity too large" saat Import Lat/Long**
Pastikan `server/index.js` sudah menggunakan limit body parser yang cukup besar:
```js
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

**Tidak bisa konek ke MySQL**
```bash
sudo service mysql status   # cek status
sudo service mysql start    # start jika belum jalan
```
Coba ganti `DB_HOST=localhost` menjadi `DB_HOST=127.0.0.1` di `.env`.

**Error saat menjalankan schema SQL**
Pastikan versi MySQL/MariaDB mendukung `SPATIAL INDEX` dan tipe `POINT`, `POLYGON`, `GEOMETRY`. Gunakan MySQL 8.0+ atau MariaDB 10.5+.

**Port 3000 sudah digunakan**
```bash
lsof -ti:3000 | xargs kill -9
```
Atau ganti `PORT` di file `.env`.

**`npm install` gagal**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Data bangunan tidak muncul**
Pastikan sudah menjalankan `database/bangunan_schema.sql` dan mengimport data GeoJSON OSM via `import-geojson.js`.

---

## 🔒 Catatan Keamanan (Produksi)

- Ganti password default database
- Jangan expose file `.env` ke publik atau commit ke repositori
- Tambahkan autentikasi pada API endpoint jika diperlukan
- Aktifkan SSL untuk koneksi database di lingkungan produksi