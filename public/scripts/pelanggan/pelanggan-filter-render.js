import { getMap } from '../polygon/polygon.js';
import { isPelangganInBuilding } from './building-pelanggan-matcher.js';
import {
    onViewportChange,
    offViewportChange,
    getPaddedBounds,
    buildBboxIndex,
    queryBboxGrid
} from '../utils/viewport-manager.js';

const FILTER_BUILDING_COLOR = '#2196F3';
let filteredBuildingLayers = [];

// State untuk viewport re-render saat pan/zoom
let _currentRenderState = null; // { type, blok, filteredPelanggan, geojsonData, filterDesc, bboxIndex }

export function getFilteredBuildingLayers() {
    return filteredBuildingLayers;
}

export function clearFilteredBuildingLayers() {
    // Unregister dari viewport manager supaya tidak re-render setelah filter dihapus
    offViewportChange(_onViewportChangeForFilter);
    _currentRenderState = null;

    const map = getMap();
    filteredBuildingLayers.forEach(layer => {
        if (map) map.removeLayer(layer);
    });
    filteredBuildingLayers = [];
}

// Viewport change handler — re-render hanya yang masuk viewport
function _onViewportChangeForFilter() {
    if (!_currentRenderState) return;

    const { type, blok, filteredPelanggan, geojsonData, filterDesc, bboxIndex } = _currentRenderState;
    const map = getMap();
    if (!map) return;

    // Clear layer lama
    filteredBuildingLayers.forEach(l => map.removeLayer(l));
    filteredBuildingLayers = [];

    if (type === 'blok') {
        _renderBlokInViewport(blok, filteredPelanggan, geojsonData, filterDesc, bboxIndex);
    } else if (type === 'nonPelanggan') {
        _renderNonPelangganInViewport(geojsonData, filteredPelanggan, bboxIndex);
    }
}

export function renderBlokHighlight(blok, filteredPelanggan, geojsonData, filterDesc = '') {
    const map = getMap();
    if (!map) return 0;

    // Pre-compute bbox index dari semua building features — O(n) sekali
    // Sehingga viewport query jadi O(k) dimana k = jumlah cell yg overlap
    const candidateFeatures = geojsonData.features
        .map((feature, index) => ({ feature, index }))
        .filter(({ feature }) => feature.properties.building);

    const bboxIndex = buildBboxIndex(candidateFeatures, ({ feature }) => {
        try {
            const b = L.geoJSON(feature).getBounds();
            return {
                minLat: b.getSouth(), maxLat: b.getNorth(),
                minLng: b.getWest(),  maxLng: b.getEast()
            };
        } catch(e) { return null; }
    });

    // Simpan state untuk re-render saat viewport berubah
    _currentRenderState = { type: 'blok', blok, filteredPelanggan, geojsonData, filterDesc, bboxIndex };

    // Render pertama kali
    const count = _renderBlokInViewport(blok, filteredPelanggan, geojsonData, filterDesc, bboxIndex);

    // Register viewport listener (unregister dulu kalau sudah ada)
    offViewportChange(_onViewportChangeForFilter);
    onViewportChange(_onViewportChangeForFilter);

    return count;
}

function _renderBlokInViewport(blok, filteredPelanggan, geojsonData, filterDesc, bboxIndex) {
    const map = getMap();
    if (!map) return 0;

    const bounds = getPaddedBounds();

    // Query grid — hanya kandidat building di viewport
    const candidatesInViewport = queryBboxGrid(bboxIndex, bounds);

    // Tentukan building mana yang mengandung pelanggan dari filteredPelanggan
    const buildingsToHighlight = new Set();

    filteredPelanggan.forEach(pelanggan => {
        const lat = parseFloat(pelanggan['Lat']);
        const lng = parseFloat(pelanggan['Long']);
        if (isNaN(lat) || isNaN(lng)) return;

        // Skip pelanggan di luar viewport (optimasi tambahan)
        if (bounds && !bounds.contains([lat, lng])) return;

        candidatesInViewport.forEach(({ feature, index }) => {
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
                layer.bindPopup(buildBlokPopupHTML(blok, pelangganInBuilding, feature, filterDesc));
            }
        });
        layer.addTo(map);
        filteredBuildingLayers.push(layer);
    });

    console.log(`[filter-render] Rendered ${buildingsToHighlight.size} / ${bboxIndex.indexed.length} buildings in viewport`);
    return buildingsToHighlight.size;
}

export function renderNonPelangganHighlight(geojsonData, pelangganData) {
    const map = getMap();
    if (!map) return 0;

    // Build bbox index untuk semua building
    const candidateFeatures = geojsonData.features
        .map((feature, index) => ({ feature, index }))
        .filter(({ feature }) => feature.properties.building);

    const bboxIndex = buildBboxIndex(candidateFeatures, ({ feature }) => {
        try {
            const b = L.geoJSON(feature).getBounds();
            return {
                minLat: b.getSouth(), maxLat: b.getNorth(),
                minLng: b.getWest(),  maxLng: b.getEast()
            };
        } catch(e) { return null; }
    });

    // Simpan state untuk re-render saat pan/zoom
    _currentRenderState = {
        type: 'nonPelanggan',
        filteredPelanggan: pelangganData, // dipakai sebagai "allPelanggan" untuk cek hasPelanggan
        geojsonData,
        bboxIndex
    };

    const count = _renderNonPelangganInViewport(geojsonData, pelangganData, bboxIndex);

    offViewportChange(_onViewportChangeForFilter);
    onViewportChange(_onViewportChangeForFilter);

    return count;
}

function _renderNonPelangganInViewport(geojsonData, pelangganData, bboxIndex) {
    const map = getMap();
    if (!map) return 0;

    const bounds = getPaddedBounds();
    const candidatesInViewport = queryBboxGrid(bboxIndex, bounds);

    let nonPelangganCount = 0;

    candidatesInViewport.forEach(({ feature }) => {
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
                    layer.bindPopup(buildNonPelangganPopupHTML(feature, layer));
                }
            });
            layer.addTo(map);
            filteredBuildingLayers.push(layer);
            nonPelangganCount++;
        }
    });

    console.log(`[filter-render] Non-pelanggan: rendered ${nonPelangganCount} buildings in viewport`);
    return nonPelangganCount;
}

function buildBlokPopupHTML(blok, pelangganInBuilding, feature, filterDesc) {
    let html = `<div style="font-size: 12px;">`;
    html += `<div style="background: #2196F3; color: white; padding: 6px; margin: -8px -8px 8px -8px; font-weight: bold;">`;
    html += `Blok ${blok} - ${pelangganInBuilding.length} pelanggan`;
    if (filterDesc) {
        html += `<div style="font-size: 10px; font-weight: normal; margin-top: 2px;">${filterDesc}</div>`;
    }
    html += `</div>`;

    if (feature.properties.name) {
        html += `<strong>Bangunan:</strong> ${feature.properties.name}<br>`;
    }

    html += `<hr style="margin: 8px 0; border-top: 1px solid #ddd;">`;

    pelangganInBuilding.forEach((pel, idx) => {
        const lunasText = parseInt(pel.lunas) === 1 ? 'Lunas' : 'Belum Lunas';
        const lunasColor = parseInt(pel.lunas) === 1 ? '#4CAF50' : '#f44336';

        html += `<div style="margin-top: 6px; padding: 6px; background: #E3F2FD; border-radius: 3px; border-left: 3px solid #2196F3;">`;
        html += `<strong>${idx + 1}. ${pel['nama']}</strong><br>`;
        html += `<span style="font-size: 11px; color: #666;">ID: ${pel['idpelanggan']}</span><br>`;
        html += `<span style="font-size: 11px; color: #ff9800;">${pel['noalamat']}</span>`;
        if (pel.pakai) {
            html += `<br><span style="font-size: 11px; color: #1976D2;">Pakai: ${pel.pakai} m³</span>`;
        }
        if (pel.lunas) {
            html += `<br><span style="font-size: 11px; color: ${lunasColor};">${lunasText}</span>`;
        }
        html += `</div>`;
    });

    html += `</div>`;
    return html;
}

function buildNonPelangganPopupHTML(feature, layer) {
    let html = `<div style="font-size: 12px;">`;
    html += `<div style="background: #800e13; color: white; padding: 6px; margin: -8px -8px 8px -8px; font-weight: bold;">`;
    html += `Bangunan Tanpa Pelanggan</div>`;

    if (feature.properties.name) {
        html += `<strong>Nama:</strong> ${feature.properties.name}<br>`;
    }
    if (feature.properties.building) {
        html += `<strong>Tipe:</strong> ${feature.properties.building}<br>`;
    }
    if (feature.properties.amenity) {
        html += `<strong>Amenity:</strong> ${feature.properties.amenity}<br>`;
    }

    const bounds = layer.getBounds();
    const center = bounds.getCenter();
    html += `<hr style="margin: 8px 0;">`;
    html += `<strong>Koordinat:</strong><br>`;
    html += `Lat: ${center.lat.toFixed(6)}<br>`;
    html += `Long: ${center.lng.toFixed(6)}`;
    html += `</div>`;

    return html;
}

export function updateFilterStatus(blok, buildingCount, pelangganCount, filterDesc = '') {
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

    if (!statusDiv) return;

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
        let html = `
            <div style="font-weight: 600; color: #1565C0; white-space: nowrap;">
                Filter Aktif: Blok ${blok}
            </div>
            <div style="color: #31572c; font-size: 12px; font-weight: bold; white-space: nowrap;">
                ${buildingCount} bangunan - ${pelangganCount} pelanggan
            </div>
        `;
        if (filterDesc) {
            html += `<div style="color: #4CAF50; font-size: 10px; margin-top: 2px; font-weight: 500; white-space: nowrap;">
                + Filter: ${filterDesc}
            </div>`;
        }
        statusDiv.innerHTML = html;
        statusDiv.style.display = 'block';
    } else {
        statusDiv.style.display = 'none';
    }
}