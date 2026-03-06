import { getMap } from '../polygon/polygon.js';
import { getPelangganData, getMarkerRow, getMarkerRowMap, _setMarkerRow, _clearMarkerRowMap } from '../pelanggan/pelanggan-store.js';
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

export function setPelangganLayerRef(layer) {
    pelangganLayerRef = layer;
    if (!layer) {
        allMarkersSnapshot = [];
        _clearMarkerRowMap();
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
                _setMarkerRow(m, rowEntries[i].row);
            }
        }
    });
}

// Cek apakah marker harus tampil berdasarkan semua filter aktif
export function markerShouldShow(marker, blok) {
    // Mode non-pelanggan: semua marker pelanggan disembunyikan
    if (blok === 'NON_PELANGGAN') return false;

    const row = getMarkerRow(marker);
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

    return Array.from(blokSet).sort((a, b) => {
        if (a.length !== b.length) return a.length - b.length; // single dulu, baru double
        return a.localeCompare(b);
    });
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

async function filterPelangganMarkers(blok) {
    if (!pelangganLayerRef) return;
    await _restoreMarkersWithFilter(blok);
}

// Helper internal: evaluasi ulang semua marker berdasarkan filter yang diberikan
// tanpa intermediate "add all" — mencegah flash UI
async function _restoreMarkersWithFilter(blok) {
    const map = getMap();
    if (!map || !pelangganLayerRef) return;

    const markersToIterate = allMarkersSnapshot.length > 0
        ? allMarkersSnapshot
        : (() => { const arr = []; pelangganLayerRef.eachLayer(l => { if (l instanceof L.Marker) arr.push(l); }); return arr; })();

    const CHUNK = 300;
    for (let i = 0; i < markersToIterate.length; i += CHUNK) {
        const chunk = markersToIterate.slice(i, i + CHUNK);
        chunk.forEach(layer => {
            if (!(layer instanceof L.Marker)) return;
            const shouldShow = markerShouldShow(layer, blok);
            const isInLayer  = pelangganLayerRef.hasLayer(layer);
            const isInMap    = map.hasLayer(layer);
            if (shouldShow) {
                if (!isInLayer && !isInMap) pelangganLayerRef.addLayer(layer);
            } else {
                if (isInLayer) pelangganLayerRef.removeLayer(layer);
                if (isInMap)   map.removeLayer(layer);
            }
        });
        if (i + CHUNK < markersToIterate.length) {
            await new Promise(r => setTimeout(r, 0));
        }
    }
}

export async function clearBuildingHighlight() {
    const map = getMap();
    if (!map) return;

    clearFilteredBuildingLayers();
    currentFilter = null;

    await _restoreMarkersWithFilter(null);

    updateFilterStatus(null, 0, 0);
}

export async function highlightBuildingsByBlok(blok, geojsonData) {
    const map = getMap();
    if (!map) return;

    // Bersihkan polygon layer dulu, set filter baru, lalu langsung filter marker
    // tanpa intermediate "restore all" supaya tidak ada flash
    clearFilteredBuildingLayers();
    currentFilter = blok;

    if (!blok) {
        // Kalau blok dikosongkan, restore semua marker berdasarkan filter aktif
        await _restoreMarkersWithFilter(null);
        updateFilterStatus(null, 0, 0);
        return;
    }

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

    await filterPelangganMarkers(blok);

    const buildingCount = renderBlokHighlight(blok, filteredPelanggan, geojsonData, filterDesc);

    console.log(`[pelanggan-filter] Highlighted ${buildingCount} buildings for blok ${blok}`);
    updateFilterStatus(blok, buildingCount, filteredPelanggan.length, filterDesc);
}

export async function highlightNonPelangganBuildings(geojsonData) {
    const map = getMap();
    if (!map) return;

    // Bersihkan polygon layer dulu, set filter, lalu langsung filter marker tanpa flash
    clearFilteredBuildingLayers();
    currentFilter = 'NON_PELANGGAN';

    const pelangganData = getPelangganData();

    console.log('[pelanggan-filter] Filtering buildings without pelanggan');

    await filterPelangganMarkers('NON_PELANGGAN');

    const nonPelangganCount = renderNonPelangganHighlight(geojsonData, pelangganData);

    console.log(`[pelanggan-filter] Highlighted ${nonPelangganCount} buildings without pelanggan`);
    updateFilterStatus('NON_PELANGGAN', nonPelangganCount, 0);
}

export async function refreshFilter(geojsonData) {
    if (!currentFilter || !geojsonData) return;

    if (currentFilter === 'NON_PELANGGAN') {
        console.log('[pelanggan-filter] Refreshing non-pelanggan filter');
        await highlightNonPelangganBuildings(geojsonData);
    } else {
        console.log(`[pelanggan-filter] Refreshing filter for blok ${currentFilter}`);
        await highlightBuildingsByBlok(currentFilter, geojsonData);
    }
}