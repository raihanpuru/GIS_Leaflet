-- ============================================================
-- Schema MariaDB - Konversi dari PostgreSQL
-- Project  : 00_Tes Leaflet
-- ============================================================

USE leaflet_db;

DROP TABLE IF EXISTS buildings;
DROP TABLE IF EXISTS pelanggan;


-- ============================================================
-- Tabel: pelanggan
-- ============================================================
CREATE TABLE pelanggan (
    id            INT AUTO_INCREMENT PRIMARY KEY,

    nosambungan   VARCHAR(50) NOT NULL,
    idpelanggan   VARCHAR(50) NOT NULL,
    nopelanggan   VARCHAR(50),
    nama          VARCHAR(255) NOT NULL,
    alamat        VARCHAR(255),
    noalamat      VARCHAR(50),
    nourut        INT,

    pakai         INT,
    tagihan       DECIMAL(12, 2),
    tglbayar      DATETIME,
    lunas         TINYINT(1) CHECK (lunas IN (0, 1)),

    longitude     DECIMAL(10, 7),
    latitude      DECIMAL(10, 7),
    -- location nullable, diisi otomatis oleh trigger
    -- SPATIAL INDEX tidak bisa pada kolom nullable, jadi pakai index biasa
    -- Query spasial tetap bisa lewat longitude & latitude
    location      POINT,

    bulan         TINYINT  NOT NULL DEFAULT 12   COMMENT 'Bulan periode tagihan (1-12)',
    tahun         SMALLINT NOT NULL DEFAULT 2025 COMMENT 'Tahun periode tagihan',

    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_nosambungan_periode (nosambungan, tahun, bulan),

    CHECK (bulan >= 1 AND bulan <= 12),
    CHECK (tahun >= 2000),

    INDEX idx_pelanggan_idpelanggan (idpelanggan),
    INDEX idx_pelanggan_nama        (nama),
    INDEX idx_pelanggan_alamat      (alamat),
    INDEX idx_pelanggan_lunas       (lunas),
    INDEX idx_pelanggan_tglbayar    (tglbayar),
    INDEX idx_pelanggan_periode     (tahun, bulan),
    -- index koordinat biasa sebagai pengganti spatial index
    INDEX idx_pelanggan_koordinat   (longitude, latitude)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- Trigger: auto-isi kolom location dari longitude & latitude
-- ============================================================
DELIMITER $$

CREATE TRIGGER pelanggan_before_insert
BEFORE INSERT ON pelanggan
FOR EACH ROW
BEGIN
    IF NEW.longitude IS NOT NULL AND NEW.latitude IS NOT NULL THEN
        SET NEW.location = ST_PointFromText(
            CONCAT('POINT(', NEW.longitude, ' ', NEW.latitude, ')')
        );
    END IF;
END$$

CREATE TRIGGER pelanggan_before_update
BEFORE UPDATE ON pelanggan
FOR EACH ROW
BEGIN
    IF NEW.longitude IS NOT NULL AND NEW.latitude IS NOT NULL THEN
        SET NEW.location = ST_PointFromText(
            CONCAT('POINT(', NEW.longitude, ' ', NEW.latitude, ')')
        );
    END IF;
END$$

DELIMITER ;


-- ============================================================
-- Tabel: buildings
-- ============================================================
CREATE TABLE buildings (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    building_id   VARCHAR(50),
    kecamatan     VARCHAR(100),
    kategori      VARCHAR(50),
    geometry      POLYGON NOT NULL,      -- NOT NULL agar bisa SPATIAL INDEX
    pelanggan_id  INT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_buildings_pelanggan
        FOREIGN KEY (pelanggan_id) REFERENCES pelanggan(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    SPATIAL INDEX idx_buildings_geometry  (geometry),
    INDEX         idx_buildings_kecamatan (kecamatan),
    INDEX         idx_buildings_kategori  (kategori),
    INDEX         idx_buildings_pelanggan (pelanggan_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- View: pelanggan_with_buildings
-- ============================================================
DROP VIEW IF EXISTS pelanggan_with_buildings;

CREATE VIEW pelanggan_with_buildings AS
SELECT
    p.id,
    p.nosambungan,
    p.idpelanggan,
    p.nopelanggan,
    p.nama,
    p.alamat,
    p.noalamat,
    p.nourut,
    p.pakai,
    p.tagihan,
    p.tglbayar,
    p.lunas,
    p.longitude,
    p.latitude,
    ST_AsGeoJSON(p.location)  AS location,
    p.bulan,
    p.tahun,
    p.created_at,
    p.updated_at,
    b.id                      AS building_id,
    b.kecamatan,
    b.kategori,
    ST_AsGeoJSON(b.geometry)  AS building_geometry
FROM pelanggan p
LEFT JOIN buildings b ON p.id = b.pelanggan_id;
