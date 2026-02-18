# 🗺️ Leaflet Pelanggan GIS — MySQL Edition

Aplikasi web GIS berbasis **Leaflet.js** untuk visualisasi dan manajemen data pelanggan dengan backend **Node.js (Express)** dan database **MySQL/MariaDB**. Proyek ini merupakan konversi dari versi PostgreSQL + PostGIS ke MySQL.

---

## 📋 Daftar Isi

- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Struktur Proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi](#konfigurasi)
- [Setup Database](#setup-database)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [API Endpoints](#api-endpoints)
- [Import Data CSV](#import-data-csv)
- [Troubleshooting](#troubleshooting)

---

## ✨ Fitur

- Visualisasi peta interaktif menggunakan **Leaflet.js**
- Manajemen data pelanggan PDAM/utilitas (tagihan, status lunas, koordinat GPS)
- Data bangunan/gedung dari **OpenStreetMap (OSM)** per kecamatan
- Query spasial berbasis koordinat longitude & latitude
- Pencarian pelanggan dan filter berdasarkan periode tagihan (bulan/tahun)
- REST API untuk integrasi frontend

---

## 🛠️ Teknologi

| Komponen   | Teknologi                        |
|------------|----------------------------------|
| Frontend   | Leaflet.js, HTML, CSS, JavaScript |
| Backend    | Node.js, Express.js              |
| Database   | MySQL / MariaDB                  |
| ORM/Driver | mysql2                           |
| Dev Tools  | nodemon, dotenv                  |

---

## 📁 Struktur Proyek

```
00_Tes Leaflet_mysql/
├── database/
│   ├── mysql_schema.sql       # Schema utama (pelanggan, buildings, view)
│   └── bangunan_schema.sql    # Schema tabel bangunan OSM
├── server/
│   ├── index.js               # Entry point server Express
│   └── scripts/
│       └── import-csv.js      # Script import data CSV
├── public/
│   └── data/
│       └── pelanggan/         # File CSV data pelanggan
├── .env                       # Konfigurasi environment (tidak di-commit)
├── .env.example               # Template konfigurasi
├── package.json
└── INSTALLATION.md
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
cd /path/to/project
```

### 2. Install Dependensi

```bash
npm install
```

### 3. Buat File Environment

```bash
cp .env.example .env
```

---

## ⚙️ Konfigurasi

Edit file `.env` sesuai konfigurasi lokal Anda:

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

> **Catatan:** File `.env` sudah di-*gitignore*, jangan di-commit ke repositori.

---

## 🗄️ Setup Database

### 1. Buat Database

Login ke MySQL dan buat database:

```sql
CREATE DATABASE leaflet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Atau via command line:

```bash
mysql -u root -p -e "CREATE DATABASE leaflet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2. Jalankan Schema Utama

```bash
mysql -u root -p leaflet_db < database/mysql_schema.sql
```

Schema ini akan membuat:
- Tabel **`pelanggan`** — data pelanggan beserta koordinat dan info tagihan
- Tabel **`buildings`** — data footprint bangunan dengan geometri poligon
- **Trigger** otomatis untuk mengisi kolom `POINT` dari `longitude` & `latitude`
- **View** `pelanggan_with_buildings` — gabungan data pelanggan dan bangunan

### 3. (Opsional) Import Data Bangunan OSM

```bash
mysql -u root -p leaflet_db < database/bangunan_schema.sql
```

### 4. Verifikasi

```bash
mysql -u root -p leaflet_db -e "SHOW TABLES;"
```

Output yang diharapkan:
```
+--------------------+
| Tables_in_leaflet_db |
+--------------------+
| buildings            |
| pelanggan            |
| bangunan             |
+--------------------+
```

---

## ▶️ Menjalankan Aplikasi

### Mode Development (auto-reload)

```bash
npm run dev
```

### Mode Production

```bash
npm start
```

Akses aplikasi di browser: **http://localhost:3000**

---

## 📡 API Endpoints

| Method | Endpoint                          | Deskripsi                              |
|--------|-----------------------------------|----------------------------------------|
| GET    | `/api/pelanggan`                  | Ambil semua data pelanggan             |
| GET    | `/api/pelanggan/stats`            | Statistik data pelanggan               |
| GET    | `/api/pelanggan/search?q=<kata>`  | Cari pelanggan berdasarkan nama/alamat |
| GET    | `/api/pelanggan/nearby`           | Cari pelanggan terdekat (koordinat)    |

Contoh request `nearby`:
```bash
curl "http://localhost:3000/api/pelanggan/nearby?lng=112.686&lat=-7.449&radius=500"
```

---

## 📥 Import Data CSV

Untuk mengimpor data pelanggan dari file CSV:

```bash
# Import file default (GHIJ)
npm run import:ghij

# Import file CSV kustom
node server/scripts/import-csv.js /path/to/file.csv
```

Format kolom CSV yang diharapkan:
```
nosambungan, idpelanggan, nopelanggan, nama, alamat, noalamat, nourut, Long, Lat
```

---

## 🔧 Troubleshooting

**Tidak bisa konek ke MySQL**
- Pastikan service MySQL berjalan: `sudo service mysql status`
- Periksa kredensial di `.env` (host, port, user, password)
- Coba ganti `DB_HOST=localhost` menjadi `DB_HOST=127.0.0.1`

**Error saat menjalankan schema**
- Pastikan versi MySQL/MariaDB mendukung `SPATIAL INDEX` dan tipe `POINT`, `POLYGON`, `GEOMETRY`
- MariaDB 10.5+ atau MySQL 8.0+ direkomendasikan

**Port 3000 sudah digunakan**
- Ganti port di `.env`: `PORT=3001`
- Atau matikan proses yang menggunakan port tersebut:
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```

**npm install gagal**
- Bersihkan cache: `npm cache clean --force`
- Hapus `node_modules` dan install ulang:
  ```bash
  rm -rf node_modules package-lock.json && npm install
  ```

---

## 🔒 Catatan Keamanan (Produksi)

- Ganti password default database
- Jangan expose `.env` ke publik atau repositori
- Aktifkan SSL untuk koneksi database
- Tambahkan autentikasi pada API endpoint
- Buat backup database secara berkala

---

## 📄 Lisensi

ISC License
