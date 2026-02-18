import { getMap } from '../polygon/polygon.js';
import { getPelangganData } from '../pelanggan/pelanggan.js';
import { downloadCSV } from '../pelanggan/pelanggan-csv.js';

const SNAP_THRESHOLD_METERS = 50;

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; 
}

function getCentroid(geometry) {
    if (geometry.type === 'Polygon') {
        const coords = geometry.coordinates[0];
        let latSum = 0, lngSum = 0;
        coords.forEach(coord => {
            lngSum += coord[0];
            latSum += coord[1];
        });
        return {
            lat: latSum / coords.length,
            lng: lngSum / coords.length
        };
    } else if (geometry.type === 'MultiPolygon') {
        const coords = geometry.coordinates[0][0];
        let latSum = 0, lngSum = 0;
        coords.forEach(coord => {
            lngSum += coord[0];
            latSum += coord[1];
        });
        return {
            lat: latSum / coords.length,
            lng: lngSum / coords.length
        };
    } else if (geometry.type === 'Point') {
        return {
            lat: geometry.coordinates[1],
            lng: geometry.coordinates[0]
        };
    }
    return null;
}

export function findNearestBuildings(kecamatan, thresholdMeters = SNAP_THRESHOLD_METERS) {
    return new Promise((resolve, reject) => {
        const geojsonPath = `kecamatan/${kecamatan}.geojson`;
        
        fetch(geojsonPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`File tidak ditemukan: ${geojsonPath}`);
                }
                return response.json();
            })
            .then(geojsonData => {
                const pelangganData = getPelangganData();
                const corrections = [];

                pelangganData.forEach(pelanggan => {
                    const pelLat = parseFloat(pelanggan['Lat']);
                    const pelLng = parseFloat(pelanggan['Long']);
                    
                    if (isNaN(pelLat) || isNaN(pelLng)) return;

                    let nearestBuilding = null;
                    let minDistance = Infinity;

                    geojsonData.features.forEach(feature => {
                        if (!feature.properties.building) return;

                        const centroid = getCentroid(feature.geometry);
                        if (!centroid) return;

                        const distance = calculateDistance(
                            pelLat, pelLng,
                            centroid.lat, centroid.lng
                        );

                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestBuilding = {
                                centroid: centroid,
                                name: feature.properties.name || 'Bangunan tanpa nama',
                                building: feature.properties.building,
                                distance: distance
                            };
                        }
                    });

                    if (nearestBuilding && minDistance <= thresholdMeters) {
                        corrections.push({
                            pelanggan: pelanggan,
                            oldLat: pelLat,
                            oldLng: pelLng,
                            newLat: nearestBuilding.centroid.lat,
                            newLng: nearestBuilding.centroid.lng,
                            distance: minDistance,
                            buildingName: nearestBuilding.name,
                            buildingType: nearestBuilding.building
                        });
                    }
                });

                resolve(corrections);
            })
            .catch(error => {
                reject(error);
            });
    });
}

export function applyCorrections(corrections) {
    const pelangganData = getPelangganData();
    let appliedCount = 0;

    corrections.forEach(correction => {
        const index = pelangganData.findIndex(
            p => p['idpelanggan'] === correction.pelanggan['idpelanggan']
        );

        if (index !== -1) {
            pelangganData[index]['Lat'] = correction.newLat.toFixed(7);
            pelangganData[index]['Long'] = correction.newLng.toFixed(7);
            appliedCount++;
        }
    });

    console.log(`[pelanggan-autocorrect.js] ${appliedCount} koreksi berhasil diterapkan`);
    return appliedCount;
}

export function showCorrectionPreview(corrections) {
    const map = getMap();
    if (!map) return null;

    const previewLayer = L.layerGroup();

    corrections.forEach((corr, index) => {
        const line = L.polyline(
            [[corr.oldLat, corr.oldLng], [corr.newLat, corr.newLng]],
            {
                color: '#ff9800',
                weight: 2,
                opacity: 0.7,
                dashArray: '5, 5'
            }
        );

        const newMarker = L.circleMarker([corr.newLat, corr.newLng], {
            radius: 6,
            fillColor: '#4CAF50',
            color: '#2e7d32',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        const popupContent = `
            <div style="font-size:12px; min-width:200px;">
                <div style="font-weight:bold; color:#ff9800; margin-bottom:6px;">
                    Koreksi Otomatis
                </div>
                <table style="width:100%; border-collapse:collapse;">
                    <tr><td style="padding:2px 0; color:#757575; width:110px;">Pelanggan</td>
                        <td style="padding:2px 0; font-weight:500;">${corr.pelanggan['nama']}</td></tr>
                    <tr><td style="padding:2px 0; color:#757575;">Bangunan Terdekat</td>
                        <td style="padding:2px 0;">${corr.buildingName}</td></tr>
                    <tr><td style="padding:2px 0; color:#757575;">Jarak</td>
                        <td style="padding:2px 0; color:#f57c00; font-weight:600;">${corr.distance.toFixed(1)} m</td></tr>
                    <tr><td style="padding:2px 0; color:#757575;">Koordinat Lama</td>
                        <td style="padding:2px 0; font-size:11px;">${corr.oldLat.toFixed(6)}, ${corr.oldLng.toFixed(6)}</td></tr>
                    <tr><td style="padding:2px 0; color:#757575;">Koordinat Baru</td>
                        <td style="padding:2px 0; font-size:11px; color:#4CAF50; font-weight:600;">${corr.newLat.toFixed(6)}, ${corr.newLng.toFixed(6)}</td></tr>
                </table>
            </div>`;

        newMarker.bindPopup(popupContent);

        previewLayer.addLayer(line);
        previewLayer.addLayer(newMarker);
    });

    previewLayer.addTo(map);
    return previewLayer;
}

export function exportCorrectedData(pelangganData) {
    const filename = downloadCSV(pelangganData, 'pelanggan_corrected');
    return filename;
}