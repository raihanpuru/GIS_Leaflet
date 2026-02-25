import { getMap, updateBuildingsWithPelanggan, toggleBuildingLayer } from '../polygon/polygon.js';
import { isValidCoord, downloadCSV } from '../pelanggan/pelanggan-csv.js';
import { pelangganAPI, PelangganAPI } from '../api/pelanggan-api.js';
import { 
    PIN_ICON, 
    SAVING_ICON,
    ERROR_ICON,
    buildPopup, 
    buildLabel, 
    createLegend,
    updateLegend,
    createControlButtons,
    updateToggleButton,
    updateDragButton
} from '../components/pelanggan-ui.js';
import { updateShowBuildingButton } from '../components/polygon-ui.js';
import { updateBlokOptions } from '../components/pelanggan-filter-ui.js';
import { setPelangganLayerRef, getCurrentFilter as getBlokFilter } from '../pelanggan/pelanggan-filter.js';
import { createCategoryFilterControl } from '../components/pelanggan-category-filter-ui.js';
import { 
    setPelangganCategoryLayerRef,
    buildMarkersMap,
    getCurrentFilters as getCategoryFilters
} from '../pelanggan/pelanggan-category-filter.js';
import { updateAddressOptions } from '../components/pelanggan-filter-ui.js';
import { getCurrentPeriod } from '../components/pelanggan-period-filter-ui.js';
import { setPelangganLayerRef as setPelangganAddressLayerRef, getCurrentAddressFilter } from '../pelanggan/pelanggan-address-filter.js';
import {
    getPelangganData, isPelangganLayerVisible, getPelangganCount,
    _setPelangganData, _setPelangganCount, _setIsPelangganVisible
} from '../pelanggan/pelanggan-store.js';
import {
    onViewportChange,
    offViewportChange,
    getPaddedBounds,
    buildSpatialIndex,
    queryGrid
} from '../utils/viewport-manager.js';


let pelangganLayer = null;
let labelLayer = null;
let isDraggingEnabled = false;
let currentKecamatan = null;

// Map untuk pasangkan marker <-> labelMarker
const markerLabelMap = new Map(); // key: marker instance, value: labelMarker instance

// Spatial index untuk label viewport culling
let markerSpatialIndex = null;

function updateLabelVisibility() {
    if (!pelangganLayer || !labelLayer) return;
    const map = getMap();
    if (!map) return;

    const bounds = getPaddedBounds();

    // Pakai spatial index kalau sudah dibangun — jauh lebih cepat dari iterasi semua marker
    let markersToCheck;
    if (markerSpatialIndex && bounds) {
        markersToCheck = queryGrid(markerSpatialIndex, bounds);
    } else {
        // Fallback: iterasi semua (saat index belum siap)
        markersToCheck = [];
        markerLabelMap.forEach((_, marker) => markersToCheck.push(marker));
    }

    // Sembunyikan semua label dulu (hanya yang currently visible)
    // — lebih cepat daripada cek satu-satu semua marker
    const currentlyVisible = new Set();
    labelLayer.eachLayer(l => currentlyVisible.add(l));
    currentlyVisible.forEach(l => labelLayer.removeLayer(l));

    // Tampilkan hanya label yang unclustered DAN ada di viewport
    markersToCheck.forEach(marker => {
        const labelMarker = markerLabelMap.get(marker);
        if (!labelMarker) return;

        const visibleParent = pelangganLayer.getVisibleParent(marker);
        const isUnclustered = visibleParent === marker;

        if (isUnclustered) {
            labelLayer.addLayer(labelMarker);
        }
    });
}

function togglePelangganLayer() {
    const map = getMap();
    if (!map || !pelangganLayer) return;

    if (isPelangganLayerVisible()) {
        map.removeLayer(pelangganLayer);
        if (labelLayer) map.removeLayer(labelLayer);
        _setIsPelangganVisible(false);
        console.log('[pelanggan.js] Layer pelanggan disembunyikan');
    } else {
        pelangganLayer.addTo(map);
        if (labelLayer) labelLayer.addTo(map);
        addPelangganLegend();
        _setIsPelangganVisible(true);
        console.log('[pelanggan.js] Layer pelanggan ditampilkan');
    }

    updateToggleButton(isPelangganLayerVisible());
}

function toggleDragMode() {
    if (!pelangganLayer) return;

    isDraggingEnabled = !isDraggingEnabled;

    pelangganLayer.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.options.icon === PIN_ICON) {
            if (isDraggingEnabled) {
                layer.dragging.enable();
            } else {
                layer.dragging.disable();
            }
        }
    });

    // Always update legend mode, regardless of visibility
    updateLegend(getPelangganCount(), isDraggingEnabled);

    updateDragButton(isDraggingEnabled);
    console.log(`[pelanggan.js] Drag mode ${isDraggingEnabled ? 'enabled' : 'disabled'}`);
}

function savePelangganCSV() {

    const period      = getCurrentPeriod();
    const activeAddr  = getCurrentAddressFilter();
    const activeBlok  = getBlokFilter();
    const catFilters  = getCategoryFilters(); // { usage, status }

    // Helper: ekstrak prefix blok dari noalamat (misal "AB12" -> "AB")
    function extractBlok(noalamat) {
        if (!noalamat) return null;
        const m = noalamat.match(/^([A-Z]+)/);
        return m ? m[1] : null;
    }

    // 2. Filter pelangganData berdasarkan state filter aktif
    const filteredData = pelangganData.filter(p => {

        // --- Filter Periode (sudah dihandle saat loadPelanggan, tapi double-check) ---
        if (period.bulan && parseInt(p.bulan) !== period.bulan) return false;
        if (period.tahun && parseInt(p.tahun) !== period.tahun) return false;

        // --- Filter Alamat ---
        if (activeAddr) {
            if (!p.alamat || p.alamat.trim() !== activeAddr) return false;
        }

        // --- Filter Blok ---
        if (activeBlok && activeBlok !== 'NON_PELANGGAN') {
            if (extractBlok(p.noalamat) !== activeBlok) return false;
        }
        // NON_PELANGGAN bukan filter yang relevan untuk CSV pelanggan

        // --- Filter Category: Usage ---
        if (catFilters.usage !== 'all') {
            const pakai = parseInt(p.pakai) || 0;
            if (catFilters.usage === 'low'  && pakai >= 20) return false;
            if (catFilters.usage === 'high' && pakai < 20)  return false;
        }

        // --- Filter Category: Status Lunas ---
        if (catFilters.status !== 'all') {
            const lunas = parseInt(p.lunas) || 0;
            if (catFilters.status === 'lunas' && lunas !== 1) return false;
            if (catFilters.status === 'belum' && lunas === 1) return false;
        }

        return true;
    });

    if (filteredData.length === 0) {
        alert('Tidak ada data pelanggan yang tampil saat ini.\nAktifkan layer pelanggan dan pastikan ada marker yang muncul.');
        return;
    }

    // 3. Bangun nama file dari filter aktif
    const filterParts = [];

    const bulanNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    if (period.bulan) filterParts.push(bulanNames[period.bulan]);
    if (period.tahun) filterParts.push(String(period.tahun));
    if (activeAddr)   filterParts.push(activeAddr.replace(/[\s\/\\]+/g, '_'));
    if (activeBlok && activeBlok !== 'NON_PELANGGAN') filterParts.push('blok' + activeBlok);
    if (catFilters.usage  !== 'all') filterParts.push(catFilters.usage);
    if (catFilters.status !== 'all') filterParts.push(catFilters.status);

    const filenameBase = filterParts.length > 0
        ? `pelanggan_${filterParts.join('_')}`
        : 'pelanggan';

    // 4. Download
    const filename = downloadCSV(filteredData, filenameBase);

    const filterDesc = filterParts.length > 0
        ? `Filter aktif: ${filterParts.join(' + ')}`
        : 'Semua data (tidak ada filter aktif)';

    alert(`✅ CSV berhasil diunduh!\nFile: ${filename}\nJumlah data: ${filteredData.length} pelanggan\n${filterDesc}`);
}

function addPelangganLegend() {
    updateLegend(getPelangganCount(), isDraggingEnabled);
}

function addControlButtons() {
    const map = getMap();
    if (!map) return;

    const control = createControlButtons({
        onToggle: togglePelangganLayer,
        onDragMode: toggleDragMode,
        onSave: savePelangganCSV,
        onShowBuilding: () => {
            const isNowVisible = toggleBuildingLayer();
            updateShowBuildingButton(isNowVisible);
        }
    });

    control.addTo(map);
}

function createPelangganMarker(row) {
    const lat  = parseFloat(row['Lat']);
    const lng  = parseFloat(row['Long']);
    const nama = (row['nama'] || '').trim();

    const marker = L.marker([lat, lng], { 
        icon: PIN_ICON,
        draggable: false 
    });
    
    marker.bindPopup(buildPopup(row));
    
    marker.on('dragend', async function(e) {
        const newLatLng = e.target.getLatLng();
        const dataIndex = pelangganData.findIndex(
            item => item['idpelanggan'] === row['idpelanggan']
        );

        if (dataIndex === -1) return;

        // Update data di memori dulu
        pelangganData[dataIndex]['Lat'] = newLatLng.lat.toFixed(7);
        pelangganData[dataIndex]['Long'] = newLatLng.lng.toFixed(7);

        marker.setPopupContent(buildPopup(pelangganData[dataIndex]));
        updateBuildingsWithPelanggan(pelangganData);

        console.log(`[pelanggan.js] Marker dipindahkan: ${nama} -> [${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}]`);

        // Sync ke DB via API
        const dbId = pelangganData[dataIndex]['_db_id'];
        if (!dbId) {
            console.warn('[pelanggan.js] _db_id tidak ditemukan, tidak bisa sync ke DB:', row['idpelanggan']);
            return;
        }

        // Visual feedback: marker jadi kuning saat saving
        marker.setIcon(SAVING_ICON);

        try {
            await pelangganAPI.update(dbId, {
                longitude: parseFloat(newLatLng.lng.toFixed(7)),
                latitude: parseFloat(newLatLng.lat.toFixed(7)),
            });
            marker.setIcon(PIN_ICON);
            console.log(`[pelanggan.js] Koordinat tersimpan ke DB: ${nama} (id=${dbId})`);
        } catch (err) {
            // Gagal sync: kembalikan marker ke posisi lama
            marker.setIcon(ERROR_ICON);
            console.error(`[pelanggan.js] Gagal sync ke DB:`, err);
            setTimeout(() => marker.setIcon(PIN_ICON), 3000);
        }
    });

    const labelMarker = L.marker([lat, lng], {
        icon: buildLabel(nama),
        interactive: false,
        zIndexOffset: -1
    });

    // Daftarkan pasangan marker <-> label
    markerLabelMap.set(marker, labelMarker);

    return { marker, labelMarker };
}

export async function loadPelanggan(periodFilter = {}) {
    const map = getMap();

    if (!map) {
        console.error('[pelanggan.js] Map belum diinisialisasi. Pastikan polygon.js diload dulu.');
        return;
    }

    try {
        const filterParams = {};
        if (periodFilter.bulan) filterParams.bulan = periodFilter.bulan;
        if (periodFilter.tahun) filterParams.tahun = periodFilter.tahun;
        
        console.log('[pelanggan.js] Mengambil data pelanggan dari API dengan filter:', filterParams);
        const response = await pelangganAPI.getAll(filterParams);

        if (!response.success) {
            throw new Error('API gagal: ' + (response.error || 'Unknown error'));
        }

        if (pelangganLayer && map.hasLayer(pelangganLayer)) {
            map.removeLayer(pelangganLayer);
        }
        if (labelLayer && map.hasLayer(labelLayer)) {
            map.removeLayer(labelLayer);
        }
        markerLabelMap.clear();

        const rows = PelangganAPI.toLegacyFormat(response.data);
        _setPelangganData(rows);

        pelangganLayer = L.markerClusterGroup({
            disableClusteringAtZoom: 18,
            maxClusterRadius: 60,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
        });

        // Update visibilitas label setiap kali animasi cluster selesai atau zoom berubah
        pelangganLayer.on('animationend', updateLabelVisibility);

        // Daftarkan ke viewport manager (debounced) — unregister dulu kalau sudah ada
        offViewportChange(updateLabelVisibility);
        onViewportChange(updateLabelVisibility);

        labelLayer = L.layerGroup(); // label mulai kosong, diisi oleh updateLabelVisibility
        let count = 0;
        let skipped = 0;

        rows.forEach(row => {
            if (!isValidCoord(row)) {
                skipped++;
                console.warn('[pelanggan.js] Koordinat tidak valid, skipped:',
                    row['idpelanggan'], row['nama'],
                    '| Lat:', row['Lat'], 'Long:', row['Long']);
                return;
            }

            const { marker, labelMarker } = createPelangganMarker(row);

            pelangganLayer.addLayer(marker);
            // labelMarker TIDAK langsung ditambahkan — dikelola oleh updateLabelVisibility()

            count++;
        });
        _setPelangganCount(count);

        // Add layer back if it was visible before
        if (isPelangganLayerVisible()) {
            pelangganLayer.addTo(map);
            labelLayer.addTo(map);
        }

        // Only add control buttons once (on first load)
        if (!document.getElementById('togglePelanggan')) {
            addControlButtons();
        }

        // Show the inline legend next to the Sidoarjo dropdown with the loaded count
        updateLegend(getPelangganCount(), isDraggingEnabled);

        setPelangganLayerRef(pelangganLayer);
        setPelangganAddressLayerRef(pelangganLayer);

        // Build spatial index untuk label viewport culling
        const markerArray = [];
        markerLabelMap.forEach((_, marker) => markerArray.push(marker));
        markerSpatialIndex = buildSpatialIndex(markerArray, marker => {
            const ll = marker.getLatLng();
            return { lat: ll.lat, lng: ll.lng };
        });
        console.log(`[pelanggan.js] Spatial index built untuk ${markerArray.length} marker`);
        
        // Only add category filter control once (on first load)
        if (!document.querySelector('.pelanggan-category-filter-control')) {
            const categoryFilterControl = createCategoryFilterControl();
            categoryFilterControl.addTo(map);
        }
        
        // Set layer reference and build markers map for category filter
        setPelangganCategoryLayerRef(pelangganLayer);
        buildMarkersMap(getPelangganData(), pelangganLayer);

        updateBuildingsWithPelanggan(getPelangganData());

        updateBlokOptions();
        updateAddressOptions();

        console.log(`[pelanggan.js] Berhasil load ${getPelangganCount()} pelanggan dari DB.` +
            (skipped ? ` (${skipped} baris di-skip karena koordinat tidak valid)` : ''));

    } catch (err) {
        console.error('[pelanggan.js] Gagal load dari API:', err);
        alert('Gagal mengambil data pelanggan dari server.\nPastikan backend berjalan dan database terhubung.\n\nError: ' + err.message);
    }
}
export function setCurrentKecamatan(kecamatan) {
    currentKecamatan = kecamatan;
    console.log(`[pelanggan.js] Kecamatan aktif: ${kecamatan}`);
}

export function clearPelangganLayer() {
    const map = getMap();

    if (pelangganLayer) {
        if (map && map.hasLayer(pelangganLayer)) map.removeLayer(pelangganLayer);
        pelangganLayer = null;
    }
    if (labelLayer) {
        if (map && map.hasLayer(labelLayer)) map.removeLayer(labelLayer);
        labelLayer = null;
    }

    markerLabelMap.clear();
    markerSpatialIndex = null;
    _setPelangganData([]);
    _setPelangganCount(0);
    _setIsPelangganVisible(false);

    setPelangganLayerRef(null);
    setPelangganAddressLayerRef(null);
    setPelangganCategoryLayerRef(null);

    updateLegend(0, false);
    updateToggleButton(false);

    console.log('[pelanggan.js] Layer pelanggan di-reset.');
}

// Re-export dari store agar modul lain yang sudah import dari pelanggan.js tetap bisa pakai
export { getPelangganData, getPelangganCount, isPelangganLayerVisible } from '../pelanggan/pelanggan-store.js';