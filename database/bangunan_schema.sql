-- ============================================================
-- Tabel: bangunan (Building Footprints dari OSM GeoJSON)
-- ============================================================

USE leaflet_db;

DROP TABLE IF EXISTS bangunan;

CREATE TABLE bangunan (
    id              INT AUTO_INCREMENT PRIMARY KEY,

    -- Identitas OSM
    osm_id          VARCHAR(50),
    kecamatan       VARCHAR(50) NOT NULL,   -- sidoarjo / candi / gedangan / buduran

    -- Properti bangunan (kolom umum)
    name            VARCHAR(255),
    building        VARCHAR(100),           -- yes, house, commercial, school, dll
    building_levels INT,
    height          DECIMAL(8,2),
    amenity         VARCHAR(100),
    shop            VARCHAR(100),
    leisure         VARCHAR(100),
    office          VARCHAR(100),
    tourism         VARCHAR(100),
    religion        VARCHAR(100),
    denomination    VARCHAR(100),
    surface         VARCHAR(100),

    -- Alamat
    addr_street     VARCHAR(255),
    addr_housenumber VARCHAR(50),
    addr_city       VARCHAR(100),
    addr_postcode   VARCHAR(20),
    addr_district   VARCHAR(100),
    addr_subdistrict VARCHAR(100),

    -- Kontak
    phone           VARCHAR(100),
    website         VARCHAR(255),
    opening_hours   TEXT,

    -- Geometry (Spatial)
    geom            GEOMETRY NOT NULL,

    -- Metadata
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    SPATIAL INDEX idx_geom (geom),
    INDEX idx_kecamatan (kecamatan),
    INDEX idx_building (building),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
