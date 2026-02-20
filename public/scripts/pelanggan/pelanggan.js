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


let pelangganLayer = null;
let pelangganCount = 0;
let isPelangganVisible = false;
let pelangganData = [];
let isDraggingEnabled = false;
let currentKecamatan = null; 

function togglePelangganLayer() {
    const map = getMap();
    if (!map || !pelangganLayer) return;

    if (isPelangganVisible) {
        map.removeLayer(pelangganLayer);
        isPelangganVisible = false;
        console.log('[pelanggan.js] Layer pelanggan disembunyikan');
    } else {
        pelangganLayer.addTo(map);
        addPelangganLegend();
        isPelangganVisible = true;
        console.log('[pelanggan.js] Layer pelanggan ditampilkan');
    }

    updateToggleButton(isPelangganVisible);
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
    updateLegend(pelangganCount, isDraggingEnabled);

    updateDragButton(isDraggingEnabled);
    console.log(`[pelanggan.js] Drag mode ${isDraggingEnabled ? 'enabled' : 'disabled'}`);
}

function savePelangganCSV() {
    // Filter data langsung dari pelangganData (array mentah),
    // tanpa menyentuh marker/layer sama sekali.
    // Pendekatan ini aman meski nanti pakai clustering atau perubahan rendering apapun.

    // 1. Baca state semua filter yang sedang aktif
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
    updateLegend(pelangganCount, isDraggingEnabled);
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

    return { marker, labelMarker };
}

export async function loadPelanggan(periodFilter = {}) {
    const map = getMap();

    if (!map) {
        console.error('[pelanggan.js] Map belum diinisialisasi. Pastikan polygon.js diload dulu.');
        return;
    }

    try {
        const filterParams = { limit: 20000 };
        if (periodFilter.bulan) filterParams.bulan = periodFilter.bulan;
        if (periodFilter.tahun) filterParams.tahun = periodFilter.tahun;
        
        console.log('[pelanggan.js] Mengambil data pelanggan dari API dengan filter:', filterParams);
        const response = await pelangganAPI.getAll(filterParams);

        if (!response.success) {
            throw new Error('API gagal: ' + (response.error || 'Unknown error'));
        }

        // Remove old layer if exists
        if (pelangganLayer && map.hasLayer(pelangganLayer)) {
            map.removeLayer(pelangganLayer);
        }

        // Konversi format DB (longitude/latitude) -> format legacy (Long/Lat)
        const rows = PelangganAPI.toLegacyFormat(response.data);
        pelangganData = rows;

        pelangganLayer = L.layerGroup();
        pelangganCount = 0;
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
            pelangganLayer.addLayer(labelMarker);

            pelangganCount++;
        });

        // Add layer back if it was visible before
        if (isPelangganVisible) {
            pelangganLayer.addTo(map);
        }

        // Only add control buttons once (on first load)
        if (!document.getElementById('togglePelanggan')) {
            addControlButtons();
        }

        // Show the inline legend next to the Sidoarjo dropdown with the loaded count
        updateLegend(pelangganCount, isDraggingEnabled);

        setPelangganLayerRef(pelangganLayer);
        setPelangganAddressLayerRef(pelangganLayer);
        
        // Only add category filter control once (on first load)
        if (!document.querySelector('.pelanggan-category-filter-control')) {
            const categoryFilterControl = createCategoryFilterControl();
            categoryFilterControl.addTo(map);
        }
        
        // Set layer reference and build markers map for category filter
        setPelangganCategoryLayerRef(pelangganLayer);
        buildMarkersMap(pelangganData, pelangganLayer);

        updateBuildingsWithPelanggan(pelangganData);

        updateBlokOptions();
        updateAddressOptions();

        console.log(`[pelanggan.js] Berhasil load ${pelangganCount} pelanggan dari DB.` +
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

export function getPelangganData() {
    return pelangganData;
}

export function getPelangganCount() {
    return pelangganCount;
}

export function isPelangganLayerVisible() {
    return isPelangganVisible;
}