import { getPelangganData, isPelangganLayerVisible } from './pelanggan-store.js';
import { getMap } from '../polygon/polygon.js';
import {
    clearFilteredBuildingLayers,
    renderBlokHighlight
} from './pelanggan-filter-render.js';

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

export function getAvailableAddresses() {
    const pelangganData = getPelangganData();
    
    if (!pelangganData || pelangganData.length === 0) {
        console.log('[address-filter] No pelanggan data available');
        return [];
    }

    // Mengambil semua alamat unik dari data pelanggan
    const addresses = new Set();
    pelangganData.forEach(p => {
        if (p.alamat && p.alamat.trim()) {
            addresses.add(p.alamat.trim());
        }
    });

    const addressArray = Array.from(addresses).sort();
    console.log('[address-filter] Available addresses:', addressArray);
    return addressArray;
}

function filterPelangganMarkersByAddress(address) {
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

    // Gunakan snapshot agar marker yang sudah diremove pun bisa di-iterate
    const markersToIterate = allMarkersSnapshot.length > 0
        ? allMarkersSnapshot
        : (() => { const arr = []; pelangganLayerRef.eachLayer(l => { if (l instanceof L.Marker) arr.push(l); }); return arr; })();

    markersToIterate.forEach(layer => {
        let shouldShow = true;
        
        if (address) {
            const latlng = layer.getLatLng();
            const pelanggan = pelangganData.find(p => {
                const lat = parseFloat(p['Lat']);
                const lng = parseFloat(p['Long']);
                return Math.abs(lat - latlng.lat) < 0.000001 && 
                       Math.abs(lng - latlng.lng) < 0.000001;
            });
            
            if (pelanggan) {
                shouldShow = (pelanggan.alamat && pelanggan.alamat.trim() === address);
            } else {
                shouldShow = false;
            }
        }
        
        // Benar-benar remove/add marker dari cluster layer, bukan dari map langsung
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

    // Filter pelanggan berdasarkan alamat yang dipilih
    const filteredPelanggan = pelangganData.filter(p => 
        p.alamat && p.alamat.trim() === address
    );

    console.log(`[address-filter] Filtering by address: ${address}`);
    console.log(`[address-filter] Found ${filteredPelanggan.length} pelanggan with address "${address}"`);

    // Hide/show pelanggan markers
    filterPelangganMarkersByAddress(address);

    // Render bangunan biru berdasarkan pelanggan yang ada di alamat ini
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