export const PELANGGAN_BUILDING_COLOR = '#2196F3';

let buildingPelangganMap = new Map(); 

function isPointInPolygon(point, polygon) {
    const x = point[0]; 
    const y = point[1]; 
    
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0];
        const yi = polygon[i][1];
        const xj = polygon[j][0];
        const yj = polygon[j][1];
        
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

function isPointInMultiPolygon(point, multiPolygon) {
    for (let polygon of multiPolygon) {
        if (isPointInPolygon(point, polygon[0])) {
            return true;
        }
    }
    return false;
}

export function isPelangganInBuilding(pelangganLat, pelangganLng, buildingFeature) {
    const geometry = buildingFeature.geometry;
    const point = [pelangganLng, pelangganLat];
    
    if (geometry.type === 'Polygon') {
        return isPointInPolygon(point, geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
        return isPointInMultiPolygon(point, geometry.coordinates);
    } else if (geometry.type === 'Point') {
        const dx = Math.abs(geometry.coordinates[0] - pelangganLng);
        const dy = Math.abs(geometry.coordinates[1] - pelangganLat);
        const distance = Math.sqrt(dx * dx + dy * dy) * 111000; 
        return distance < 5;
    }
    
    return false;
}

export function findPelangganInBuilding(buildingFeature, pelangganData) {
    const pelanggans = [];
    
    pelangganData.forEach(pelanggan => {
        const lat = parseFloat(pelanggan['Lat']);
        const lng = parseFloat(pelanggan['Long']);
        
        if (isNaN(lat) || isNaN(lng)) return;
        
        if (isPelangganInBuilding(lat, lng, buildingFeature)) {
            pelanggans.push(pelanggan);
        }
    });
    
    return pelanggans;
}

/**
 * Build spatial grid index untuk pelanggan — grid sel ~0.002 derajat (~200m).
 * Dipakai di getPelangganForBuildingFast() untuk pre-filter sebelum point-in-polygon.
 * @param {Array} pelangganData
 * @returns {{ grid: Map, CELL: number }}
 */
export function buildPelangganSpatialIndex(pelangganData) {
    const CELL = 0.002; // ~200m per sel
    const grid = new Map();

    pelangganData.forEach(p => {
        const lat = parseFloat(p['Lat']);
        const lng = parseFloat(p['Long']);
        if (isNaN(lat) || isNaN(lng)) return;

        const gx = Math.floor(lat / CELL);
        const gy = Math.floor(lng / CELL);
        const key = `${gx}:${gy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(p);
    });

    return { grid, CELL };
}

/**
 * Versi cepat: pre-filter pelanggan via grid sebelum point-in-polygon.
 * Mengurangi operasi dari O(buildings × semua_pelanggan) → O(buildings × pelanggan_terdekat).
 * @param {Object} buildingFeature - GeoJSON feature
 * @param {{ grid: Map, CELL: number }} pelangganIndex
 * @returns {Array}
 */
export function getPelangganForBuildingFast(buildingFeature, pelangganIndex) {
    if (!buildingFeature.properties.building) return [];

    const { grid, CELL } = pelangganIndex;
    const geom = buildingFeature.geometry;
    if (!geom) return [];

    // Hitung bbox bangunan
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    const coords = geom.type === 'Polygon'      ? geom.coordinates[0]
                 : geom.type === 'MultiPolygon' ? geom.coordinates[0][0]
                 : geom.type === 'Point'        ? [geom.coordinates]
                 : null;
    if (!coords) return [];

    coords.forEach(([lng, lat]) => {
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
    });

    // Ambil sel grid yang overlap dengan bbox bangunan (+ 1 sel padding)
    const minGx = Math.floor(minLat / CELL) - 1;
    const maxGx = Math.floor(maxLat / CELL) + 1;
    const minGy = Math.floor(minLng / CELL) - 1;
    const maxGy = Math.floor(maxLng / CELL) + 1;

    const candidates = new Set();
    for (let gx = minGx; gx <= maxGx; gx++) {
        for (let gy = minGy; gy <= maxGy; gy++) {
            const list = grid.get(`${gx}:${gy}`);
            if (list) list.forEach(p => candidates.add(p));
        }
    }

    // Point-in-polygon hanya untuk kandidat terdekat
    const result = [];
    candidates.forEach(p => {
        const lat = parseFloat(p['Lat']);
        const lng = parseFloat(p['Long']);
        if (!isNaN(lat) && !isNaN(lng) && isPelangganInBuilding(lat, lng, buildingFeature)) {
            result.push(p);
        }
    });

    return result;
}

export function mapBuildingsToPelanggan(geojsonData, pelangganData) {
    buildingPelangganMap.clear();
    
    let buildingCount = 0;
    let totalPelangganMapped = 0;
    
    geojsonData.features.forEach((feature, index) => {
        if (!feature.properties.building) return;
        
        const pelanggans = findPelangganInBuilding(feature, pelangganData);
        
        if (pelanggans.length > 0) {
            const key = `building_${index}`;
            buildingPelangganMap.set(key, {
                feature: feature,
                pelanggans: pelanggans
            });
            buildingCount++;
            totalPelangganMapped += pelanggans.length;
        }
    });
    
    console.log(`[building-pelanggan-matcher] ${buildingCount} bangunan memiliki pelanggan`);
    console.log(`[building-pelanggan-matcher] Total ${totalPelangganMapped} pelanggan di-map ke bangunan`);
    
    return buildingPelangganMap;
}

export function buildingHasPelanggan(feature, pelangganData) {
    if (!feature.properties.building) return false;
    
    const pelanggans = findPelangganInBuilding(feature, pelangganData);
    return pelanggans.length > 0;
}

export function getPelangganForBuilding(feature, pelangganData) {
    if (!feature.properties.building) return [];
    return findPelangganInBuilding(feature, pelangganData);
}

export function getBuildingPelangganMap() {
    return buildingPelangganMap;
}

export function clearBuildingPelangganMap() {
    buildingPelangganMap.clear();
    console.log('[building-pelanggan-matcher] Map cleared');
}