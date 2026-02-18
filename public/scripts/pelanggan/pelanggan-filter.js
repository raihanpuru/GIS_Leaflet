import { getMap } from '../polygon/polygon.js';
import { getPelangganData } from '../pelanggan/pelanggan.js';
import { getCurrentFilters as getCategoryFilters } from './pelanggan-category-filter.js';
import { getCurrentAddressFilter } from './pelanggan-address-filter.js';

const FILTER_BUILDING_COLOR = '#2196F3';
let filteredBuildingLayers = [];
let currentFilter = null;
let pelangganLayerRef = null;

export function setPelangganLayerRef(layer) {
    pelangganLayerRef = layer;
}

function filterPelangganMarkers(blok) {
    if (!pelangganLayerRef) return;
    
    const pelangganData = getPelangganData();
    const map = getMap();
    const activeAddress = getCurrentAddressFilter();
    
    pelangganLayerRef.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            let shouldShow = true;
            
            if (blok && blok !== 'NON_PELANGGAN') {
                const latlng = layer.getLatLng();
                const pelanggan = pelangganData.find(p => {
                    const lat = parseFloat(p['Lat']);
                    const lng = parseFloat(p['Long']);
                    return Math.abs(lat - latlng.lat) < 0.000001 && 
                           Math.abs(lng - latlng.lng) < 0.000001;
                });
                
                if (pelanggan) {
                    const pelangganBlok = extractBlok(pelanggan['noalamat']);
                    const blokMatch = (pelangganBlok === blok);
                    // Also check address filter if active
                    const addressMatch = !activeAddress || 
                        (pelanggan.alamat && pelanggan.alamat.trim() === activeAddress);
                    shouldShow = blokMatch && addressMatch;
                } else {
                    shouldShow = false;
                }
            } else if (blok === 'NON_PELANGGAN') {
                shouldShow = false;
            }
            
            // Use remove/add from map (same approach as address-filter)
            if (map) {
                if (shouldShow) {
                    if (!map.hasLayer(layer)) layer.addTo(map);
                } else {
                    if (map.hasLayer(layer)) map.removeLayer(layer);
                }
            } else {
                layer.setOpacity(shouldShow ? 1 : 0);
            }
        }
    });
}

function extractBlok(noalamat) {
    if (!noalamat) return null;
    const match = noalamat.match(/^([A-Z]+)/);
    return match ? match[1] : null;
}

export function getAvailableBloks(filterByAddress = null) {
    const pelangganData = getPelangganData();
    const blokSet = new Set();
    
    pelangganData.forEach(pelanggan => {
        // Jika ada filter address, skip pelanggan dengan alamat berbeda
        if (filterByAddress && pelanggan.alamat && pelanggan.alamat.trim() !== filterByAddress) {
            return;
        }
        
        const blok = extractBlok(pelanggan['noalamat']);
        if (blok) {
            blokSet.add(blok);
        }
    });
    
    return Array.from(blokSet).sort();
}

function filterPelangganByBlok(blok) {
    const pelangganData = getPelangganData();
    const categoryFilters = getCategoryFilters();
    const activeAddress = getCurrentAddressFilter();
    
    return pelangganData.filter(pelanggan => {
        // Filter by blok
        const pelangganBlok = extractBlok(pelanggan['noalamat']);
        if (pelangganBlok !== blok) return false;
        
        // Filter by active address if set
        if (activeAddress && pelanggan.alamat && pelanggan.alamat.trim() !== activeAddress) {
            return false;
        }
        
        // Apply usage filter if active
        if (categoryFilters.usage !== 'all') {
            const pakai = parseInt(pelanggan.pakai) || 0;
            if (categoryFilters.usage === 'low' && pakai >= 20) return false;
            if (categoryFilters.usage === 'high' && pakai < 20) return false;
        }
        
        // Apply status filter if active
        if (categoryFilters.status !== 'all') {
            const lunas = parseInt(pelanggan.lunas) || 0;
            if (categoryFilters.status === 'lunas' && lunas !== 1) return false;
            if (categoryFilters.status === 'belum' && lunas === 1) return false;
        }
        
        return true;
    });
}

export function highlightBuildingsByBlok(blok, geojsonData) {
    const map = getMap();
    if (!map) return;
    
    clearBuildingHighlight();
    
    if (!blok) return;
    
    currentFilter = blok;
    const filteredPelanggan = filterPelangganByBlok(blok);
    const categoryFilters = getCategoryFilters();
    
    // Get filter description text
    let filterDesc = '';
    if (categoryFilters.usage !== 'all' || categoryFilters.status !== 'all') {
        const usageText = categoryFilters.usage === 'low' ? '< 20 m³' : 
                         categoryFilters.usage === 'high' ? '≥ 20 m³' : '';
        const statusText = categoryFilters.status === 'lunas' ? 'Lunas' : 
                          categoryFilters.status === 'belum' ? 'Belum Lunas' : '';
        
        const parts = [];
        if (usageText) parts.push(usageText);
        if (statusText) parts.push(statusText);
        filterDesc = parts.join(' & ');
    }
    
    console.log(`[pelanggan-filter] Filtering blok ${blok}: ${filteredPelanggan.length} pelanggan${filterDesc ? ' (with category filters: ' + filterDesc + ')' : ''}`);
    
    filterPelangganMarkers(blok);
    
    const buildingsToHighlight = new Set();
    
    filteredPelanggan.forEach(pelanggan => {
        const lat = parseFloat(pelanggan['Lat']);
        const lng = parseFloat(pelanggan['Long']);
        
        if (isNaN(lat) || isNaN(lng)) return;
        
        geojsonData.features.forEach((feature, index) => {
            if (!feature.properties.building) return;
            
            if (isPelangganInBuilding(lat, lng, feature)) {
                buildingsToHighlight.add(index);
            }
        });
    });
    
    buildingsToHighlight.forEach(index => {
        const feature = geojsonData.features[index];
        
        const layer = L.geoJSON(feature, {
            style: {
                fillColor: FILTER_BUILDING_COLOR,
                weight: 3,
                opacity: 1,
                color: '#c1121f',
                fillOpacity: 0.7
            },
            onEachFeature: function(feature, layer) {
                const pelangganInBuilding = filteredPelanggan.filter(p => {
                    const lat = parseFloat(p['Lat']);
                    const lng = parseFloat(p['Long']);
                    return isPelangganInBuilding(lat, lng, feature);
                });
                
                let popupContent = `<div style="font-size: 12px;">`;
                popupContent += `<div style="background: #2196F3; color: white; padding: 6px; margin: -8px -8px 8px -8px; font-weight: bold;">`;
                popupContent += `Blok ${blok} - ${pelangganInBuilding.length} pelanggan`;
                if (filterDesc) {
                    popupContent += `<div style="font-size: 10px; font-weight: normal; margin-top: 2px;">${filterDesc}</div>`;
                }
                popupContent += `</div>`;
                
                if (feature.properties.name) {
                    popupContent += `<strong>Bangunan:</strong> ${feature.properties.name}<br>`;
                }
                
                popupContent += `<hr style="margin: 8px 0; border-top: 1px solid #ddd;">`;
                
                pelangganInBuilding.forEach((pel, idx) => {
                    popupContent += `<div style="margin-top: 6px; padding: 6px; background: #E3F2FD; border-radius: 3px; border-left: 3px solid #2196F3;">`;
                    popupContent += `<strong>${idx + 1}. ${pel['nama']}</strong><br>`;
                    popupContent += `<span style="font-size: 11px; color: #666;">ID: ${pel['idpelanggan']}</span><br>`;
                    popupContent += `<span style="font-size: 11px; color: #ff9800;">${pel['noalamat']}</span>`;
                    if (pel.pakai) {
                        popupContent += `<br><span style="font-size: 11px; color: #1976D2;">Pakai: ${pel.pakai} m³</span>`;
                    }
                    if (pel.lunas) {
                        const lunasText = parseInt(pel.lunas) === 1 ? 'Lunas' : 'Belum Lunas';
                        const lunasColor = parseInt(pel.lunas) === 1 ? '#4CAF50' : '#f44336';
                        popupContent += `<br><span style="font-size: 11px; color: ${lunasColor};">${lunasText}</span>`;
                    }
                    popupContent += `</div>`;
                });
                
                popupContent += `</div>`;
                layer.bindPopup(popupContent);
            }
        });
        
        layer.addTo(map);
        filteredBuildingLayers.push(layer);
    });
    
    console.log(`[pelanggan-filter] Highlighted ${buildingsToHighlight.size} buildings for blok ${blok}`);
    updateFilterStatus(blok, buildingsToHighlight.size, filteredPelanggan.length, filterDesc);
}

export function clearBuildingHighlight() {
    const map = getMap();
    if (!map) return;
    
    filteredBuildingLayers.forEach(layer => {
        map.removeLayer(layer);
    });
    
    filteredBuildingLayers = [];
    currentFilter = null;
    
    // Restore markers respecting active address filter
    const activeAddress = getCurrentAddressFilter();
    if (pelangganLayerRef && map) {
        const pelangganData = getPelangganData();
        pelangganLayerRef.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                if (!activeAddress) {
                    // No address filter active - show all
                    if (!map.hasLayer(layer)) layer.addTo(map);
                } else {
                    // Address filter still active - only show matching
                    const latlng = layer.getLatLng();
                    const pelanggan = pelangganData.find(p => {
                        const lat = parseFloat(p['Lat']);
                        const lng = parseFloat(p['Long']);
                        return Math.abs(lat - latlng.lat) < 0.000001 &&
                               Math.abs(lng - latlng.lng) < 0.000001;
                    });
                    const shouldShow = pelanggan && pelanggan.alamat && 
                                      pelanggan.alamat.trim() === activeAddress;
                    if (shouldShow) {
                        if (!map.hasLayer(layer)) layer.addTo(map);
                    } else {
                        if (map.hasLayer(layer)) map.removeLayer(layer);
                    }
                }
            }
        });
    }
    
    updateFilterStatus(null, 0, 0);
}

function isPelangganInBuilding(pelangganLat, pelangganLng, buildingFeature) {
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

function updateFilterStatus(blok, buildingCount, pelangganCount, filterDesc = '') {
    let statusDiv = document.getElementById('filter-status');
    
    if (!statusDiv && blok) {
        const legendEl = document.getElementById('pelanggan-puri-legend');
        if (legendEl) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'filter-status';
            statusDiv.style.cssText = `
                margin-left: 8px;
                padding-left: 10px;
                border-left: 2px solid #e0e0e0;
                font-size: 14px;
            `;
            legendEl.appendChild(statusDiv);
        }
    }
    
    if (statusDiv) {
        if (blok === 'NON_PELANGGAN') {
            statusDiv.innerHTML = `
                <div style="font-weight: 600; color: #616161; white-space: nowrap;">
                    Filter: Tanpa Pelanggan
                </div>
                <div style="color: #666; font-size: 11px; white-space: nowrap;">
                    ${buildingCount} bangunan kosong
                </div>
            `;
            statusDiv.style.display = 'block';
        } else if (blok) {
            let statusHTML = `
                <div style="font-weight: 600; color: #1565C0; white-space: nowrap;">
                    Filter Aktif: Blok ${blok}
                </div>
                <div style="color: #31572c; font-size: 12px; font-weight: bold; white-space: nowrap;">
                    ${buildingCount} bangunan - ${pelangganCount} pelanggan
                </div>
            `;
            if (filterDesc) {
                statusHTML += `<div style="color: #4CAF50; font-size: 10px; margin-top: 2px; font-weight: 500; white-space: nowrap;">
                    + Filter: ${filterDesc}
                </div>`;
            }
            statusDiv.innerHTML = statusHTML;
            statusDiv.style.display = 'block';
        } else {
            statusDiv.style.display = 'none';
        }
    }
}

export function getCurrentFilter() {
    return currentFilter;
}

export function refreshFilter(geojsonData) {
    if (currentFilter && geojsonData) {
        if (currentFilter === 'NON_PELANGGAN') {
            console.log('[pelanggan-filter] Refreshing non-pelanggan filter');
            highlightNonPelangganBuildings(geojsonData);
        } else {
            console.log(`[pelanggan-filter] Refreshing filter for blok ${currentFilter}`);
            highlightBuildingsByBlok(currentFilter, geojsonData);
        }
    }
}

export function highlightNonPelangganBuildings(geojsonData) {
    const map = getMap();
    if (!map) return;
    
    clearBuildingHighlight();
    
    currentFilter = 'NON_PELANGGAN';
    const pelangganData = getPelangganData();
    
    console.log('[pelanggan-filter] Filtering buildings without pelanggan');
    
    filterPelangganMarkers('NON_PELANGGAN');
    
    let nonPelangganCount = 0;
    
    geojsonData.features.forEach((feature, index) => {
        if (!feature.properties.building) return;
        
        let hasPelanggan = false;
        
        for (let pelanggan of pelangganData) {
            const lat = parseFloat(pelanggan['Lat']);
            const lng = parseFloat(pelanggan['Long']);
            
            if (isNaN(lat) || isNaN(lng)) continue;
            
            if (isPelangganInBuilding(lat, lng, feature)) {
                hasPelanggan = true;
                break;
            }
        }
        
        if (!hasPelanggan) {
            const layer = L.geoJSON(feature, {
                style: {
                    fillColor: '#800e13',
                    weight: 3,
                    opacity: 1,
                    color: '#c1121f',
                    fillOpacity: 0.6
                },
                onEachFeature: function(feature, layer) {
                    let popupContent = `<div style="font-size: 12px;">`;
                    popupContent += `<div style="background: #800e13; color: white; padding: 6px; margin: -8px -8px 8px -8px; font-weight: bold;">`;
                    popupContent += `Bangunan Tanpa Pelanggan`;
                    popupContent += `</div>`;
                    
                    if (feature.properties.name) {
                        popupContent += `<strong>Nama:</strong> ${feature.properties.name}<br>`;
                    }
                    if (feature.properties.building) {
                        popupContent += `<strong>Tipe:</strong> ${feature.properties.building}<br>`;
                    }
                    if (feature.properties.amenity) {
                        popupContent += `<strong>Amenity:</strong> ${feature.properties.amenity}<br>`;
                    }
                    
                    const bounds = layer.getBounds();
                    const center = bounds.getCenter();
                    popupContent += `<hr style="margin: 8px 0;">`;
                    popupContent += `<strong>Koordinat:</strong><br>`;
                    popupContent += `Lat: ${center.lat.toFixed(6)}<br>`;
                    popupContent += `Long: ${center.lng.toFixed(6)}`;
                    
                    popupContent += `</div>`;
                    layer.bindPopup(popupContent);
                }
            });
            
            layer.addTo(map);
            filteredBuildingLayers.push(layer);
            nonPelangganCount++;
        }
    });
    
    console.log(`[pelanggan-filter] Highlighted ${nonPelangganCount} buildings without pelanggan`);
    updateFilterStatus('NON_PELANGGAN', nonPelangganCount, 0);
}