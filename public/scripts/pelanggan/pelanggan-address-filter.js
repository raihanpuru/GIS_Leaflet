import { getPelangganData, isPelangganLayerVisible, getMarkerRow } from './pelanggan-store.js';
import { getMap } from '../polygon/polygon.js';
import {
    clearFilteredBuildingLayers,
    renderBlokHighlight
} from './pelanggan-filter-render.js';
import { groupAddresses, buildAddressLookup, matchesByGroup } from './pelanggan-address-grouper.js';
import { updateActiveFilterStatus } from '../components/pelanggan-ui.js';

// Disimpan dari luar lewat setCategoryFiltersRef() untuk hindari circular import
let _categoryFiltersRef = null;
export function setCategoryFiltersRef(getterFn) {
    _categoryFiltersRef = getterFn;
}
function _getCatFilters() {
    return _categoryFiltersRef ? _categoryFiltersRef() : { usage: 'all', status: 'all' };
}

// Cache grup dan lookup — di-rebuild tiap kali data berubah
let _addressGroups = [];
let _addressLookup = new Map();

let pelangganLayerRef = null;
let currentFilter = null;

// Simpan semua marker original agar bisa di-restore meski sudah di-removeLayer()
let allMarkersSnapshot = [];

export function setPelangganLayerRef(layer) {
    pelangganLayerRef = layer;
    // Snapshot semua marker saat layer baru di-set
    allMarkersSnapshot = [];
    if (layer) {
        layer.eachLayer(l => {
            if (l instanceof L.Marker) allMarkersSnapshot.push(l);
        });
    }
}

function rebuildGroups() {
    const pelangganData = getPelangganData();
    if (!pelangganData || pelangganData.length === 0) {
        _addressGroups = [];
        _addressLookup = new Map();
        return;
    }
    const rawAddresses = [...new Set(
        pelangganData.map(p => p.alamat && p.alamat.trim()).filter(Boolean)
    )];
    _addressGroups = groupAddresses(rawAddresses);
    _addressLookup = buildAddressLookup(_addressGroups);
    console.log('[address-filter] Address groups:', _addressGroups.map(g =>
        `"${g.label}" (${g.members.length} varian: ${g.members.join(', ')})`
    ));
}

export function getAvailableAddresses() {
    rebuildGroups();
    // Return label grup, bukan raw address
    return _addressGroups.map(g => g.label);
}

export function getAddressGroups() {
    return _addressGroups;
}

async function filterPelangganMarkersByAddress(groupLabel) {
    if (!pelangganLayerRef) {
        console.log('[address-filter] No pelanggan layer reference');
        return;
    }

    const pelangganData = getPelangganData();
    const map = getMap();

    if (!map) {
        console.log('[address-filter] Map not available');
        return;
    }

    const markersToIterate = allMarkersSnapshot.length > 0
        ? allMarkersSnapshot
        : (() => { const arr = []; pelangganLayerRef.eachLayer(l => { if (l instanceof L.Marker) arr.push(l); }); return arr; })();

    const CHUNK = 300;
    for (let i = 0; i < markersToIterate.length; i += CHUNK) {
        const chunk = markersToIterate.slice(i, i + CHUNK);
        chunk.forEach(layer => {
            let shouldShow = true;

            if (groupLabel) {
                // O(1) lookup via marker→row map, tanpa coordinate matching O(n²)
                const row = getMarkerRow(layer);
                if (row) {
                    shouldShow = matchesByGroup(row.alamat && row.alamat.trim(), groupLabel, _addressLookup);
                } else {
                    shouldShow = false;
                }
            }

            if (shouldShow) {
                if (!pelangganLayerRef.hasLayer(layer)) {
                    pelangganLayerRef.addLayer(layer);
                }
            } else {
                if (pelangganLayerRef.hasLayer(layer)) {
                    pelangganLayerRef.removeLayer(layer);
                }
            }
        });
        if (i + CHUNK < markersToIterate.length) {
            await new Promise(r => setTimeout(r, 0));
        }
    }
}

export async function highlightBuildingsByAddress(address, geojsonData) {
    if (!address) {
        console.log('[address-filter] No address provided');
        clearBuildingHighlight();
        return;
    }

    currentFilter = address;
    const pelangganData = getPelangganData();

    // Pastikan grup sudah dibangun
    if (_addressLookup.size === 0) rebuildGroups();

    // Filter pelanggan berdasarkan grup alamat yang dipilih
    const catFilters = _getCatFilters();
    const filteredPelanggan = pelangganData.filter(p => {
        if (!matchesByGroup(p.alamat && p.alamat.trim(), address, _addressLookup)) return false;
        if (catFilters.usage !== 'all') {
            const pakai = parseInt(p.pakai) || 0;
            if (catFilters.usage === 'low'  && pakai >= 20) return false;
            if (catFilters.usage === 'high' && pakai < 20)  return false;
        }
        if (catFilters.status !== 'all') {
            const lunas = parseInt(p.lunas) || 0;
            if (catFilters.status === 'lunas' && lunas !== 1) return false;
            if (catFilters.status === 'belum' && lunas === 1) return false;
        }
        return true;
    });

    console.log(`[address-filter] Filtering by group: ${address}`);
    console.log(`[address-filter] Found ${filteredPelanggan.length} pelanggan in group "${address}"`);

    // Hide/show pelanggan markers
    await filterPelangganMarkersByAddress(address);

    // Render bangunan biru berdasarkan pelanggan yang ada di grup alamat ini
    clearFilteredBuildingLayers();
    if (geojsonData) {
        renderBlokHighlight('_address_', filteredPelanggan, geojsonData, `Alamat: ${address}`);
    }

    const map = getMap();
    if (map && pelangganLayerRef && !map.hasLayer(pelangganLayerRef)) {
        pelangganLayerRef.addTo(map);
        console.log('[address-filter] Auto-menampilkan pelangganLayer karena filter alamat aktif');
    }

    // Update info panel
    updateInfoPanel(address, filteredPelanggan.length);
}

export async function clearBuildingHighlight() {
    console.log('[address-filter] Clearing address filter');

    currentFilter = null;

    // Hapus highlight bangunan biru
    clearFilteredBuildingLayers();
    // Gunakan snapshot agar marker yang sudah diremove pun bisa dikembalikan
    const map = getMap();
    if (pelangganLayerRef) {
        const markersToRestore = allMarkersSnapshot.length > 0
            ? allMarkersSnapshot
            : (() => { const arr = []; pelangganLayerRef.eachLayer(l => { if (l instanceof L.Marker) arr.push(l); }); return arr; })();

        const CHUNK = 300;
        for (let i = 0; i < markersToRestore.length; i += CHUNK) {
            markersToRestore.slice(i, i + CHUNK).forEach(layer => {
                if (!pelangganLayerRef.hasLayer(layer)) {
                    pelangganLayerRef.addLayer(layer);
                }
            });
            if (i + CHUNK < markersToRestore.length) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    }

    // Show all pelanggan markers by adding them back to the cluster layer
    if (map && pelangganLayerRef && !isPelangganLayerVisible()) {
        if (map.hasLayer(pelangganLayerRef)) {
            map.removeLayer(pelangganLayerRef);
            console.log('[address-filter] Filter dihapus & pelangganLayer disembunyikan kembali (toggle OFF)');
        }
    }

    // Clear info panel
    const infoPanel = document.getElementById('addressFilterInfo');
    if (infoPanel) {
        infoPanel.style.display = 'none';
    }
    updateActiveFilterStatus({ mode: null });
}

function updateInfoPanel(address, pelangganCount) {
    // Panel lama (floating bottom-right) — sembunyikan, pakai header sebagai gantinya
    const infoPanel = document.getElementById('addressFilterInfo');
    if (infoPanel) infoPanel.style.display = 'none';

    updateActiveFilterStatus({ mode: 'address', address, pelangganCount });
}

export function getCurrentAddressFilter() {
    return currentFilter;
}

export function refreshAddressFilter() {
    if (currentFilter) {
        const geojsonData = window.getCurrentGeojsonData ? window.getCurrentGeojsonData() : null;
        if (geojsonData) {
            highlightBuildingsByAddress(currentFilter, geojsonData);
        }
    }
}