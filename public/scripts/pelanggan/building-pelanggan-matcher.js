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