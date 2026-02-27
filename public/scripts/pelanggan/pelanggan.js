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
    updateDragButton,
    showFixKoordButton,
    toggleFixKoordPanel,
    updateFixKoordInfo
} from '../components/pelanggan-ui.js';
import { updateShowBuildingButton } from '../components/polygon-ui.js';
import { updateBlokOptions } from '../components/pelanggan-filter-ui.js';
import { setPelangganLayerRef, getCurrentFilter as getBlokFilter, getAllMarkersSnapshot, refreshFilter, addToMarkersSnapshot } from '../pelanggan/pelanggan-filter.js';
import { createCategoryFilterControl } from '../components/pelanggan-category-filter-ui.js';
import { 
    setPelangganCategoryLayerRef,
    buildMarkersMap,
    getCurrentFilters as getCategoryFilters,
    registerMarkerForCategory
} from '../pelanggan/pelanggan-category-filter.js';
import { updateAddressOptions } from '../components/pelanggan-filter-ui.js';
import { getCurrentPeriod } from '../components/pelanggan-period-filter-ui.js';
import { setPelangganLayerRef as setPelangganAddressLayerRef, getCurrentAddressFilter, getAddressGroups } from '../pelanggan/pelanggan-address-filter.js';
import { buildAddressLookup, matchesByGroup } from '../pelanggan/pelanggan-address-grouper.js';
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
import { showLoading, hideLoading } from '../utils/loading.js';


let pelangganLayer = null;
let labelLayer = null;
let isDraggingEnabled = false;
let currentKecamatan = null;

// Map untuk pasangkan marker <-> labelMarker
const markerLabelMap = new Map(); // key: marker instance, value: labelMarker instance

// Spatial index untuk viewport culling (marker + label)
let markerSpatialIndex = null;

// Viewport culling untuk marker
let allRowData = []; // { row, marker, labelMarker }[]
let rowSpatialIndex = null;
const addedMarkers = new Set(); // Set of entry objects yang sudah di-add ke cluster

function updateMarkerVisibility() {
    if (!pelangganLayer || !labelLayer) return;
    const map = getMap();
    if (!map) return;

    const bounds = getPaddedBounds();
    if (!bounds) return;

    const rowsInViewport = rowSpatialIndex
        ? new Set(queryGrid(rowSpatialIndex, bounds))
        : new Set(allRowData);

    const toAdd = [];
    const toRemove = [];

    allRowData.forEach(entry => {
        const inViewport = rowsInViewport.has(entry);
        const isAdded = addedMarkers.has(entry);

        if (inViewport && !isAdded) {
            toAdd.push(entry);
        } else if (!inViewport && isAdded) {
            toRemove.push(entry);
        }
    });

    if (toRemove.length > 0) {
        pelangganLayer.removeLayers(toRemove.map(e => e.marker));
        toRemove.forEach(e => addedMarkers.delete(e));
    }
    if (toAdd.length > 0) {
        const activeBlok    = getBlokFilter();
        const activeAddress = getCurrentAddressFilter();
        const catFilters    = getCategoryFilters();
        const hasCatFilter  = catFilters.usage !== 'all' || catFilters.status !== 'all';
        const hasAnyFilter  = activeBlok || activeAddress || hasCatFilter;

        const toAddVisible = [];

        toAdd.forEach(entry => {
            // Gunakan entry.row langsung — tidak perlu find() via koordinat
            const p = entry.row;

            let shouldShow = true;

            if (activeAddress) {
                const lookup = buildAddressLookup(getAddressGroups());
                if (!matchesByGroup(p.alamat && p.alamat.trim(), activeAddress, lookup)) shouldShow = false;
            }
            if (shouldShow && activeBlok && activeBlok !== 'NON_PELANGGAN') {
                const m = p['noalamat'] && p['noalamat'].match(/^([A-Z]+)/);
                if (!m || m[1] !== activeBlok) shouldShow = false;
            }
            if (shouldShow && hasCatFilter) {
                const pakai = parseInt(p.pakai) || 0;
                const lunas = parseInt(p.lunas) || 0;
                if (catFilters.usage === 'low'    && pakai >= 20) shouldShow = false;
                if (catFilters.usage === 'high'   && pakai < 20)  shouldShow = false;
                if (catFilters.status === 'lunas' && lunas !== 1) shouldShow = false;
                if (catFilters.status === 'belum' && lunas === 1) shouldShow = false;
            }

            if (shouldShow) toAddVisible.push(entry);
        });

        // Hanya add yang lolos filter ke layer
        pelangganLayer.addLayers(toAddVisible.map(e => e.marker));
        toAdd.forEach(e => addedMarkers.add(e));

        // Daftarkan semua ke snapshot dan category tracker
        addToMarkersSnapshot(toAdd.map(e => e.marker), toAdd);
        toAdd.forEach(e => registerMarkerForCategory(e.marker, getPelangganData()));
    }

    if (toAdd.length > 0 || toRemove.length > 0) {
        console.log(`[pelanggan.js] Viewport update: +${toAdd.length} / -${toRemove.length} (aktif: ${addedMarkers.size})`);
    }

    updateLabelVisibility();
}

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
        updateMarkerVisibility(); // render marker di viewport saat ini
        addPelangganLegend();
        _setIsPelangganVisible(true);
        console.log('[pelanggan.js] Layer pelanggan ditampilkan');
    }

    updateToggleButton(isPelangganLayerVisible());
}

// Simpan marker yang dilepas dari cluster saat mode edit aktif
let _detachedMarkers = [];

function toggleDragMode() {
    if (!pelangganLayer) return;

    isDraggingEnabled = !isDraggingEnabled;
    const map = getMap();

    if (isDraggingEnabled) {
        // Ambil SEMUA marker dari snapshot (termasuk yang sudah difilter/hidden)
        // bukan hanya dari eachLayer() yang hanya return marker visible
        const snapshot = getAllMarkersSnapshot();
        _detachedMarkers = snapshot.length > 0
            ? snapshot
            : (() => { const arr = []; pelangganLayer.eachLayer(l => { if (l instanceof L.Marker) arr.push(l); }); return arr; })();

        // Lepas dari cluster - cek visibility SEBELUM removeLayers
        _detachedMarkers.forEach(marker => {
            marker._wasVisibleBeforeEdit = pelangganLayer.hasLayer(marker);
        });

        pelangganLayer.removeLayers(_detachedMarkers);

        _detachedMarkers.forEach(marker => {
            if (marker._wasVisibleBeforeEdit) {
                marker.addTo(map);
            } else {
                // Tambahkan sementara ke map agar dragging bisa di-init, lalu langsung sembunyikan
                marker.addTo(map);
                map.removeLayer(marker);
            }
            if (marker.dragging) marker.dragging.enable();
        });

        setPelangganLayerRef(pelangganLayer);
    } else {
        // Kembalikan semua marker ke cluster
        _detachedMarkers.forEach(marker => {
            if (marker.dragging) marker.dragging.disable();
            if (map.hasLayer(marker)) map.removeLayer(marker);
        });
        pelangganLayer.addLayers(_detachedMarkers);

        // Kembalikan state filter: sembunyikan marker yang sebelumnya hidden
        _detachedMarkers.forEach(marker => {
            if (!marker._wasVisibleBeforeEdit) {
                if (pelangganLayer.hasLayer(marker)) pelangganLayer.removeLayer(marker);
            }
            delete marker._wasVisibleBeforeEdit;
        });

        _detachedMarkers = [];
        setPelangganLayerRef(pelangganLayer);
    }

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
    const filteredData = getPelangganData().filter(p => {

        // --- Filter Periode (sudah dihandle saat loadPelanggan, tapi double-check) ---
        if (period.bulan && parseInt(p.bulan) !== period.bulan) return false;
        if (period.tahun && parseInt(p.tahun) !== period.tahun) return false;

        // --- Filter Alamat ---
        if (activeAddr) {
            const lookup = buildAddressLookup(getAddressGroups());
            if (!matchesByGroup(p.alamat && p.alamat.trim(), activeAddr, lookup)) return false;
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

// ─── Fix Koordinat ───────────────────────────────────────────────────────────

function isKoordinatInvalid(lat, lng) {
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return true;
    if (lat === 0 && lng === 0) return true;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return true;
    // Range Jawa Timur ± buffer
    if (lat < -9 || lat > -6 || lng < 110 || lng > 115) return true;
    return false;
}

function getInvalidPelanggan() {
    const seen = new Set();
    return getPelangganData().filter(p => {
        const lat = parseFloat(p.Lat);
        const lng = parseFloat(p.Long);
        if (!isKoordinatInvalid(lat, lng)) return false;
        if (seen.has(p.nosambungan)) return false;
        seen.add(p.nosambungan);
        return true;
    });
}

let fixKoordMode = false;
let selectedNosambungan = null;

function startFixKoordMode(nosambungan) {
    selectedNosambungan = nosambungan;
    if (!nosambungan) {
        updateFixKoordInfo(null);
        return;
    }

    const map = getMap();
    if (!map) return;

    const p = getPelangganData().find(d => d.nosambungan === nosambungan);
    const label = (p?.noalamat || '') + ' - ' + (p?.nama || '-');
    updateFixKoordInfo('Klik peta untuk set lokasi: ' + label);

    if (!fixKoordMode) {
        fixKoordMode = true;
        map.getContainer().style.cursor = 'crosshair';

        map.once('click', async function(e) {
            fixKoordMode = false;
            map.getContainer().style.cursor = '';

            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            const ok = confirm(
                'Set koordinat ' + label + '\nke [' +
                lat.toFixed(6) + ', ' + lng.toFixed(6) + ']?'
            );
            if (!ok) {
                updateFixKoordInfo('Dibatalkan. Pilih pelanggan lagi untuk mencoba.');
                return;
            }

            updateFixKoordInfo('Menyimpan...');

            try {
                await pelangganAPI.updateCoordsByNosambungan(nosambungan, lat, lng);
                updateFixKoordInfo('✅ Berhasil! Reload untuk melihat marker.');

                // Update in-memory
                getPelangganData().forEach(item => {
                    if (item.nosambungan === nosambungan) {
                        item.Lat = lat.toFixed(7);
                        item.Long = lng.toFixed(7);
                    }
                });

                // Refresh list invalid
                showFixKoordButton(getInvalidPelanggan());

            } catch (err) {
                console.error('[fix-koordinat] Gagal simpan:', err);
                updateFixKoordInfo('❌ Gagal menyimpan. Coba lagi.');
            }
        });
    }
}

function toggleFixKoord() {
    toggleFixKoordPanel((nosambungan) => startFixKoordMode(nosambungan));
}

// ─────────────────────────────────────────────────────────────────────────────

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
        onFixKoordinat: toggleFixKoord,
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
        const data = getPelangganData(); // selalu ambil referensi terbaru dari store
        const dataIndex = data.findIndex(
            item => item['idpelanggan'] === row['idpelanggan']
        );

        if (dataIndex === -1) {
            console.warn('[pelanggan.js] Data tidak ditemukan untuk:', row['idpelanggan']);
            return;
        }

        // Update data di memori dulu
        data[dataIndex]['Lat'] = newLatLng.lat.toFixed(7);
        data[dataIndex]['Long'] = newLatLng.lng.toFixed(7);

        marker.setPopupContent(buildPopup(data[dataIndex]));
        updateBuildingsWithPelanggan(data);

        console.log(`[pelanggan.js] Marker dipindahkan: ${nama} -> [${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}]`);

        // Sync ke DB via API - update semua periode sekaligus via nosambungan
        const nosambungan = data[dataIndex]['nosambungan'];
        if (!nosambungan) {
            console.warn('[pelanggan.js] nosambungan tidak ditemukan, tidak bisa sync ke DB:', row['idpelanggan']);
            return;
        }

        // Update in-memory: semua record dengan nosambungan yang sama
        const latStr = newLatLng.lat.toFixed(7);
        const lngStr = newLatLng.lng.toFixed(7);
        data.forEach(item => {
            if (item['nosambungan'] === nosambungan) {
                item['Lat'] = latStr;
                item['Long'] = lngStr;
            }
        });

        // Visual feedback: marker jadi kuning + loading overlay
        marker.setIcon(SAVING_ICON);
        showLoading('Menyimpan koordinat...');

        // Pakai setTimeout(0) agar browser sempat render loading overlay dulu
        // sebelum mulai proses async (sama seperti pola .then() di polygon.js)
        setTimeout(() => {
            pelangganAPI.updateCoordsByNosambungan(
                nosambungan,
                parseFloat(latStr),
                parseFloat(lngStr)
            )
            .then(result => {
                marker.setIcon(PIN_ICON);
                console.log(`[pelanggan.js] Koordinat tersimpan ke DB: ${nama} (${result.affectedRows} record diupdate, nosambungan=${nosambungan})`);
            })
            .catch(err => {
                marker.setIcon(ERROR_ICON);
                console.error(`[pelanggan.js] Gagal sync ke DB:`, err);
                setTimeout(() => marker.setIcon(PIN_ICON), 3000);
            })
            .finally(() => {
                hideLoading();
            });
        }, 0);
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

export function loadPelanggan(periodFilter = {}) {
    const map = getMap();

    if (!map) {
        console.error('[pelanggan.js] Map belum diinisialisasi. Pastikan polygon.js diload dulu.');
        return;
    }

    const filterParams = {};
    if (periodFilter.bulan) filterParams.bulan = periodFilter.bulan;
    if (periodFilter.tahun) filterParams.tahun = periodFilter.tahun;

    const params = new URLSearchParams(filterParams).toString();
    const url = `/api/pelanggan${params ? '?' + params : ''}`;

    console.log('[pelanggan.js] Mengambil data pelanggan dari API dengan filter:', filterParams);

    fetch(url)
        .then(res => {
            if (!res.ok) return res.json().then(err => { throw new Error(err.error || `Gagal fetch pelanggan`); });
            return res.json();
        })
        .then(response => {
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

            pelangganLayer.on('animationend', updateLabelVisibility);

            offViewportChange(updateMarkerVisibility);
            onViewportChange(updateMarkerVisibility);

            labelLayer = L.layerGroup();
            allRowData = [];
            addedMarkers.clear();
            markerLabelMap.clear();
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
                allRowData.push({ row, marker, labelMarker });
                count++;
            });
            _setPelangganCount(count);

            // Build spatial index berdasarkan row entries (untuk viewport culling marker)
            rowSpatialIndex = buildSpatialIndex(allRowData, entry => ({
                lat: parseFloat(entry.row['Lat']),
                lng: parseFloat(entry.row['Long'])
            }));

            // Build marker spatial index untuk label culling
            const markerArray = [];
            markerLabelMap.forEach((_, marker) => markerArray.push(marker));
            markerSpatialIndex = buildSpatialIndex(markerArray, marker => {
                const ll = marker.getLatLng();
                return { lat: ll.lat, lng: ll.lng };
            });
            console.log(`[pelanggan.js] Spatial index built untuk ${count} marker`);

            if (isPelangganLayerVisible()) {
                pelangganLayer.addTo(map);
                labelLayer.addTo(map);
                // Render marker di viewport saat ini
                updateMarkerVisibility();
            }

            if (!document.getElementById('togglePelanggan')) {
                addControlButtons();
            }

            updateLegend(getPelangganCount(), isDraggingEnabled);

            setPelangganLayerRef(pelangganLayer);
            setPelangganAddressLayerRef(pelangganLayer);

            if (!document.querySelector('.pelanggan-category-filter-control')) {
                const categoryFilterControl = createCategoryFilterControl();
                categoryFilterControl.addTo(map);
            }

            setPelangganCategoryLayerRef(pelangganLayer);
            buildMarkersMap(getPelangganData(), pelangganLayer);

            updateBuildingsWithPelanggan(getPelangganData());

            updateBlokOptions();
            updateAddressOptions();

            // Cek koordinat invalid, tampilkan button Fix Koordinat kalau ada
            showFixKoordButton(getInvalidPelanggan());

            console.log(`[pelanggan.js] Berhasil load ${getPelangganCount()} pelanggan dari DB.` +
                (skipped ? ` (${skipped} baris di-skip karena koordinat tidak valid)` : ''));
        })
        .catch(err => {
            console.error('[pelanggan.js] Gagal load dari API:', err);
            alert('Gagal mengambil data pelanggan dari server.\nPastikan backend berjalan dan database terhubung.\n\nError: ' + err.message);
        })
        .finally(() => {
            hideLoading();
        });
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
    allRowData = [];
    rowSpatialIndex = null;
    addedMarkers.clear();
    offViewportChange(updateMarkerVisibility);
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