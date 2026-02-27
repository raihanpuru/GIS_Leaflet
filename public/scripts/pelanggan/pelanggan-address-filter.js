import { getPelangganData, isPelangganLayerVisible } from './pelanggan-store.js';
import { getMap } from '../polygon/polygon.js';
import {
    clearFilteredBuildingLayers,
    renderBlokHighlight
} from './pelanggan-filter-render.js';
import { groupAddresses, buildAddressLookup, matchesByGroup } from './pelanggan-address-grouper.js';

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

function filterPelangganMarkersByAddress(groupLabel) {
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

    markersToIterate.forEach(layer => {
        let shouldShow = true;

        if (groupLabel) {
            const latlng = layer.getLatLng();
            const pelanggan = pelangganData.find(p => {
                const lat = parseFloat(p['Lat'] || p.latitude);
                const lng = parseFloat(p['Long'] || p.longitude);
                return Math.abs(lat - latlng.lat) < 0.000001 &&
                       Math.abs(lng - latlng.lng) < 0.000001;
            });

            if (pelanggan) {
                shouldShow = matchesByGroup(pelanggan.alamat && pelanggan.alamat.trim(), groupLabel, _addressLookup);
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
}

export function highlightBuildingsByAddress(address, geojsonData) {
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
    const filteredPelanggan = pelangganData.filter(p =>
        matchesByGroup(p.alamat && p.alamat.trim(), address, _addressLookup)
    );

    console.log(`[address-filter] Filtering by group: ${address}`);
    console.log(`[address-filter] Found ${filteredPelanggan.length} pelanggan in group "${address}"`);

    // Hide/show pelanggan markers
    filterPelangganMarkersByAddress(address);

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

export function clearBuildingHighlight() {
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

        markersToRestore.forEach(layer => {
            if (!pelangganLayerRef.hasLayer(layer)) {
                pelangganLayerRef.addLayer(layer);
            }
        });
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
}

function updateInfoPanel(address, pelangganCount) {
    let infoPanel = document.getElementById('addressFilterInfo');
    
    if (!infoPanel) {
        infoPanel = document.createElement('div');
        infoPanel.id = 'addressFilterInfo';
        infoPanel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 999;
            font-size: 12px;
            border-left: 4px solid #FF9800;
            max-width: 300px;
        `;
        document.body.appendChild(infoPanel);
    }

    infoPanel.innerHTML = `
        <div style="font-weight: 600; color: #E65100; margin-bottom: 6px; font-size: 13px;">
            Filter Alamat Aktif
        </div>
        <div style="color: #333; margin-bottom: 4px;">
            <strong>Alamat:</strong> ${address}
        </div>
        <div style="color: #666; font-size: 11px;">
            <div>👥 ${pelangganCount} pelanggan ditampilkan</div>
        </div>
    `;
    infoPanel.style.display = 'block';
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