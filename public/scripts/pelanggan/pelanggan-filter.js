import { getMap } from '../polygon/polygon.js';
import { getPelangganData } from '../pelanggan/pelanggan-store.js';
import { getCurrentFilters as getCategoryFilters } from './pelanggan-category-filter.js';
import { getCurrentAddressFilter, getAddressGroups } from './pelanggan-address-filter.js';
import { buildAddressLookup, matchesByGroup } from './pelanggan-address-grouper.js';
import { isPelangganInBuilding } from './building-pelanggan-matcher.js';
import {
    clearFilteredBuildingLayers,
    renderBlokHighlight,
    renderNonPelangganHighlight,
    updateFilterStatus
} from './pelanggan-filter-render.js';

let currentFilter = null;
let pelangganLayerRef = null;
// Snapshot semua marker agar restore bisa dilakukan meski marker sudah di-removeLayer()
let allMarkersSnapshot = [];
// Map dari marker object ke row data — untuk lookup O(1) tanpa koordinat matching
let _markerToRow = new Map();

export function setPelangganLayerRef(layer) {
    pelangganLayerRef = layer;
    if (!layer) {
        allMarkersSnapshot = [];
        _markerToRow = new Map();
    } else if (allMarkersSnapshot.length === 0) {
        layer.eachLayer(l => {
            if (l instanceof L.Marker) allMarkersSnapshot.push(l);
        });
    }
}

// Dipanggil dari updateMarkerVisibility saat marker baru masuk viewport
export function addToMarkersSnapshot(markers, rowEntries) {
    markers.forEach((m, i) => {
        if (m instanceof L.Marker && !allMarkersSnapshot.includes(m)) {
            allMarkersSnapshot.push(m);
            if (rowEntries && rowEntries[i]) {
                _markerToRow.set(m, rowEntries[i].row);
            }
        }
    });
}

// Cek apakah marker harus tampil berdasarkan semua filter aktif
function markerShouldShow(marker, blok) {
    const row = _markerToRow.get(marker);
    if (!row) return blok ? false : true; // tidak ada data row, hide kalau ada filter

    const activeAddress   = getCurrentAddressFilter();
    const catFilters      = getCategoryFilters();

    if (activeAddress) {
        const lookup = buildAddressLookup(getAddressGroups());
        if (!matchesByGroup(row.alamat && row.alamat.trim(), activeAddress, lookup)) return false;
    }

    if (blok && blok !== 'NON_PELANGGAN') {
        const m = row['noalamat'] && row['noalamat'].match(/^([A-Z]+)/);
        if (!m || m[1] !== blok) return false;
    }

    if (catFilters.usage !== 'all') {
        const pakai = parseInt(row.pakai) || 0;
        if (catFilters.usage === 'low'  && pakai >= 20) return false;
        if (catFilters.usage === 'high' && pakai < 20)  return false;
    }

    if (catFilters.status !== 'all') {
        const lunas = parseInt(row.lunas) || 0;
        if (catFilters.status === 'lunas' && lunas !== 1) return false;
        if (catFilters.status === 'belum' && lunas === 1) return false;
    }

    return true;
}

export function getCurrentFilter() {
    return currentFilter;
}

export function getAllMarkersSnapshot() {
    return allMarkersSnapshot;
}

function extractBlok(noalamat) {
    if (!noalamat) return null;
    const match = noalamat.match(/^([A-Z]+)/);
    return match ? match[1] : null;
}

export function getAvailableBloks(filterByAddress = null) {
    const pelangganData = getPelangganData();
    const blokSet = new Set();
    const lookup = filterByAddress ? buildAddressLookup(getAddressGroups()) : null;

    pelangganData.forEach(pelanggan => {
        if (filterByAddress && !matchesByGroup(pelanggan.alamat && pelanggan.alamat.trim(), filterByAddress, lookup)) {
            return;
        }
        const blok = extractBlok(pelanggan['noalamat']);
        if (blok) blokSet.add(blok);
    });

    return Array.from(blokSet).sort();
}

function filterPelangganByBlok(blok) {
    const pelangganData = getPelangganData();
    const categoryFilters = getCategoryFilters();
    const activeAddress = getCurrentAddressFilter();

    return pelangganData.filter(pelanggan => {
        const pelangganBlok = extractBlok(pelanggan['noalamat']);
        if (pelangganBlok !== blok) return false;

        if (activeAddress && pelanggan.alamat && pelanggan.alamat.trim() !== activeAddress) {
            return false;
        }

        if (categoryFilters.usage !== 'all') {
            const pakai = parseInt(pelanggan.pakai) || 0;
            if (categoryFilters.usage === 'low' && pakai >= 20) return false;
            if (categoryFilters.usage === 'high' && pakai < 20) return false;
        }

        if (categoryFilters.status !== 'all') {
            const lunas = parseInt(pelanggan.lunas) || 0;
            if (categoryFilters.status === 'lunas' && lunas !== 1) return false;
            if (categoryFilters.status === 'belum' && lunas === 1) return false;
        }

        return true;
    });
}

function filterPelangganMarkers(blok) {
    if (!pelangganLayerRef) return;
    const map = getMap();

    const markersToIterate = allMarkersSnapshot.length > 0
        ? allMarkersSnapshot
        : (() => { const arr = []; pelangganLayerRef.eachLayer(l => { if (l instanceof L.Marker) arr.push(l); }); return arr; })();

    markersToIterate.forEach(layer => {
        if (!(layer instanceof L.Marker)) return;

        const shouldShow = blok === 'NON_PELANGGAN' ? false : markerShouldShow(layer, blok);

        if (map) {
            const isInLayer = pelangganLayerRef.hasLayer(layer);
            const isInMap   = map.hasLayer(layer);
            if (shouldShow) {
                if (!isInLayer && !isInMap) pelangganLayerRef.addLayer(layer);
            } else {
                if (isInLayer) pelangganLayerRef.removeLayer(layer);
                if (isInMap)   map.removeLayer(layer);
            }
        } else {
            layer.setOpacity(shouldShow ? 1 : 0);
        }
    });
}

export function clearBuildingHighlight() {
    const map = getMap();
    if (!map) return;

    clearFilteredBuildingLayers();
    currentFilter = null;

    const markersToRestore = allMarkersSnapshot.length > 0
        ? allMarkersSnapshot
        : (() => { const arr = []; if (pelangganLayerRef) pelangganLayerRef.eachLayer(l => { if (l instanceof L.Marker) arr.push(l); }); return arr; })();

    if (pelangganLayerRef && map) {
        markersToRestore.forEach(layer => {
            if (!(layer instanceof L.Marker)) return;

            // null blok = tidak ada filter blok, cek alamat + category saja
            const shouldShow  = markerShouldShow(layer, null);
            const isInLayer   = pelangganLayerRef.hasLayer(layer);
            const isInMap     = map.hasLayer(layer);

            if (shouldShow) {
                if (!isInLayer && !isInMap) pelangganLayerRef.addLayer(layer);
            } else {
                if (isInLayer) pelangganLayerRef.removeLayer(layer);
                if (isInMap)   map.removeLayer(layer);
            }
        });
    }

    updateFilterStatus(null, 0, 0);
}

export function highlightBuildingsByBlok(blok, geojsonData) {
    const map = getMap();
    if (!map) return;

    clearBuildingHighlight();
    if (!blok) return;

    currentFilter = blok;
    const filteredPelanggan = filterPelangganByBlok(blok);
    const categoryFilters = getCategoryFilters();

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

    const buildingCount = renderBlokHighlight(blok, filteredPelanggan, geojsonData, filterDesc);

    console.log(`[pelanggan-filter] Highlighted ${buildingCount} buildings for blok ${blok}`);
    updateFilterStatus(blok, buildingCount, filteredPelanggan.length, filterDesc);
}

export function highlightNonPelangganBuildings(geojsonData) {
    const map = getMap();
    if (!map) return;

    clearBuildingHighlight();
    currentFilter = 'NON_PELANGGAN';

    const pelangganData = getPelangganData();

    console.log('[pelanggan-filter] Filtering buildings without pelanggan');

    filterPelangganMarkers('NON_PELANGGAN');

    const nonPelangganCount = renderNonPelangganHighlight(geojsonData, pelangganData);

    console.log(`[pelanggan-filter] Highlighted ${nonPelangganCount} buildings without pelanggan`);
    updateFilterStatus('NON_PELANGGAN', nonPelangganCount, 0);
}

export function refreshFilter(geojsonData) {
    if (!currentFilter || !geojsonData) return;

    if (currentFilter === 'NON_PELANGGAN') {
        console.log('[pelanggan-filter] Refreshing non-pelanggan filter');
        highlightNonPelangganBuildings(geojsonData);
    } else {
        console.log(`[pelanggan-filter] Refreshing filter for blok ${currentFilter}`);
        highlightBuildingsByBlok(currentFilter, geojsonData);
    }
}