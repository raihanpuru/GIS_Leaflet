import { getMap } from '../polygon/polygon.js';
import { getPelangganData } from '../pelanggan/pelanggan-store.js';
import { getCurrentFilters as getCategoryFilters } from './pelanggan-category-filter.js';
import { getCurrentAddressFilter } from './pelanggan-address-filter.js';
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
    allMarkersSnapshot = [];
    if (layer) {
        layer.eachLayer(l => {
            if (l instanceof L.Marker) allMarkersSnapshot.push(l);
        });
    }
}

export function getCurrentFilter() {
    return currentFilter;
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
        if (filterByAddress && pelanggan.alamat && pelanggan.alamat.trim() !== filterByAddress) {
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

    const pelangganData = getPelangganData();
    const map = getMap();
    const activeAddress = getCurrentAddressFilter();

    // Gunakan snapshot agar marker yang sudah diremove pun bisa di-iterate
    const markersToIterate = allMarkersSnapshot.length > 0
        ? allMarkersSnapshot
        : (() => { const arr = []; pelangganLayerRef.eachLayer(l => { if (l instanceof L.Marker) arr.push(l); }); return arr; })();

    markersToIterate.forEach(layer => {
        if (!(layer instanceof L.Marker)) return;

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
                const blokMatch = pelangganBlok === blok;
                const addressMatch = !activeAddress ||
                    (pelanggan.alamat && pelanggan.alamat.trim() === activeAddress);
                shouldShow = blokMatch && addressMatch;
            } else {
                shouldShow = false;
            }
        } else if (blok === 'NON_PELANGGAN') {
            shouldShow = false;
        }

        if (map) {
            if (shouldShow) {
                if (!pelangganLayerRef.hasLayer(layer)) pelangganLayerRef.addLayer(layer);
            } else {
                if (pelangganLayerRef.hasLayer(layer)) pelangganLayerRef.removeLayer(layer);
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

    const activeAddress = getCurrentAddressFilter();

    // Gunakan snapshot agar marker yang sudah di-removeLayer() pun bisa dikembalikan
    const markersToRestore = allMarkersSnapshot.length > 0
        ? allMarkersSnapshot
        : (() => { const arr = []; if (pelangganLayerRef) pelangganLayerRef.eachLayer(l => { if (l instanceof L.Marker) arr.push(l); }); return arr; })();

    if (pelangganLayerRef && map) {
        const pelangganData = getPelangganData();
        markersToRestore.forEach(layer => {
            if (!(layer instanceof L.Marker)) return;

            if (!activeAddress) {
                if (!pelangganLayerRef.hasLayer(layer)) pelangganLayerRef.addLayer(layer);
            } else {
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
                    if (!pelangganLayerRef.hasLayer(layer)) pelangganLayerRef.addLayer(layer);
                } else {
                    if (pelangganLayerRef.hasLayer(layer)) pelangganLayerRef.removeLayer(layer);
                }
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