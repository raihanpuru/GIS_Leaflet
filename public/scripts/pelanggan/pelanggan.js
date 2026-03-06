/**
 * pelanggan.js  — Entry point & koordinator utama
 * Tanggung jawab:
 *   - Kontrol UI: toggle layer, drag mode, save CSV, fix koordinat
 *   - clearPelangganLayer, setCurrentKecamatan
 *   - Re-export publik dari store
 *
 * Detail implementasi marker  → pelanggan-marker.js
 * Detail implementasi loading → pelanggan-loader.js
 * Shared layer state          → pelanggan-layer-state.js
 */

import { getMap }                     from '../polygon/polygon.js';
import { toggleBuildingLayer }        from '../polygon/polygon.js';
import { downloadCSV }                from '../pelanggan/pelanggan-csv.js';
import { pelangganAPI }               from '../api/pelanggan-api.js';
import {
    updateLegend, updateToggleButton, updateDragButton,
    showFixKoordButton, toggleFixKoordPanel, updateFixKoordInfo
}                                     from '../components/pelanggan-ui.js';
import { updateShowBuildingButton }   from '../components/polygon-ui.js';
import {
    setPelangganLayerRef,
    getCurrentFilter as getBlokFilter,
    getAllMarkersSnapshot,
    markerShouldShow
}                                     from '../pelanggan/pelanggan-filter.js';
import { setPelangganCategoryLayerRef } from '../pelanggan/pelanggan-category-filter.js';
import {
    setPelangganLayerRef as setPelangganAddressLayerRef,
    getCurrentAddressFilter,
    getAddressGroups
}                                     from '../pelanggan/pelanggan-address-filter.js';
import { getCurrentFilters as getCategoryFilters } from '../pelanggan/pelanggan-category-filter.js';
import { buildAddressLookup, matchesByGroup } from '../pelanggan/pelanggan-address-grouper.js';
import { getCurrentPeriod }           from '../components/pelanggan-period-filter-ui.js';
import {
    getPelangganData, isPelangganLayerVisible, getPelangganCount,
    _setPelangganData, _setPelangganCount, _setIsPelangganVisible,
    getInvalidPelanggan
}                                     from '../pelanggan/pelanggan-store.js';
import {
    onViewportChange, offViewportChange
}                                     from '../utils/viewport-manager.js';

import {
    getPelangganLayer, getLabelLayer,
    setPelangganLayerObj, setLabelLayerObj,
    clearMarkerLabelMap, clearAllRowData, clearAddedMarkers,
    setRowSpatialIndex, setMarkerSpatialIndex,
    getIsDraggingEnabled, setIsDraggingEnabled,
    getDetachedMarkers, setDetachedMarkers,
    setLoadedBbox, setIsFetchingBbox, setCurrentPeriodFilter,
    setControlCallbacks, getOnViewportOutOfBoundsRef
}                                     from '../pelanggan/pelanggan-layer-state.js';
import { updateMarkerVisibility, updateLabelVisibility } from '../pelanggan/pelanggan-marker.js';

let currentKecamatan = null;

// ── Layer Toggle ──────────────────────────────────────────────────────────────

export function togglePelangganLayer() {
    const map            = getMap();
    const pelangganLayer = getPelangganLayer();
    const labelLayer     = getLabelLayer();
    if (!map || !pelangganLayer) return;

    if (isPelangganLayerVisible()) {
        map.removeLayer(pelangganLayer);
        if (labelLayer) map.removeLayer(labelLayer);
        _setIsPelangganVisible(false);
        console.log('[pelanggan.js] Layer pelanggan disembunyikan');
    } else {
        pelangganLayer.addTo(map);
        if (labelLayer) labelLayer.addTo(map);
        updateMarkerVisibility();
        updateLegend(getPelangganCount(), getIsDraggingEnabled());
        _setIsPelangganVisible(true);
        console.log('[pelanggan.js] Layer pelanggan ditampilkan');
    }

    updateToggleButton(isPelangganLayerVisible());
}

// ── Drag Mode ─────────────────────────────────────────────────────────────────

export function toggleDragMode() {
    const pelangganLayer = getPelangganLayer();
    if (!pelangganLayer) return;

    const map = getMap();
    setIsDraggingEnabled(!getIsDraggingEnabled());

    if (getIsDraggingEnabled()) {
        const snapshot = getAllMarkersSnapshot();
        const detached = snapshot.length > 0
            ? snapshot
            : (() => { const arr = []; pelangganLayer.eachLayer(l => { if (l instanceof L.Marker) arr.push(l); }); return arr; })();
        setDetachedMarkers(detached);

        // Simpan visibility sebelum edit
        getDetachedMarkers().forEach(marker => {
            marker._wasVisibleBeforeEdit = pelangganLayer.hasLayer(marker);
        });

        pelangganLayer.removeLayers(getDetachedMarkers());

        getDetachedMarkers().forEach(marker => {
            marker.addTo(map);
            if (!marker._wasVisibleBeforeEdit) map.removeLayer(marker);
            if (marker.dragging) marker.dragging.enable();
        });

        setPelangganLayerRef(pelangganLayer);
    } else {
        getDetachedMarkers().forEach(marker => {
            if (marker.dragging) marker.dragging.disable();
            if (map.hasLayer(marker)) map.removeLayer(marker);
            delete marker._wasVisibleBeforeEdit;
        });
        pelangganLayer.addLayers(getDetachedMarkers());

        // Re-apply filter aktif — bukan _wasVisibleBeforeEdit yang mungkin stale
        const activeBlok = getBlokFilter();
        getDetachedMarkers().forEach(marker => {
            if (!markerShouldShow(marker, activeBlok)) {
                if (pelangganLayer.hasLayer(marker)) pelangganLayer.removeLayer(marker);
            }
        });

        setDetachedMarkers([]);
        setPelangganLayerRef(pelangganLayer);
    }

    updateLegend(getPelangganCount(), getIsDraggingEnabled());
    updateDragButton(getIsDraggingEnabled());
    console.log(`[pelanggan.js] Drag mode ${getIsDraggingEnabled() ? 'enabled' : 'disabled'}`);
}

// ── Save CSV ──────────────────────────────────────────────────────────────────

export function savePelangganCSV() {
    const period     = getCurrentPeriod();
    const activeAddr = getCurrentAddressFilter();
    const activeBlok = getBlokFilter();
    const catFilters = getCategoryFilters();

    function extractBlok(noalamat) {
        if (!noalamat) return null;
        const m = noalamat.match(/^([A-Z]+)/);
        return m ? m[1] : null;
    }

    const filteredData = getPelangganData().filter(p => {
        if (period.bulan && parseInt(p.bulan) !== period.bulan) return false;
        if (period.tahun && parseInt(p.tahun) !== period.tahun) return false;

        if (activeAddr) {
            const lookup = buildAddressLookup(getAddressGroups());
            if (!matchesByGroup(p.alamat && p.alamat.trim(), activeAddr, lookup)) return false;
        }

        if (activeBlok && activeBlok !== 'NON_PELANGGAN') {
            if (extractBlok(p.noalamat) !== activeBlok) return false;
        }

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

    if (filteredData.length === 0) {
        alert('Tidak ada data pelanggan yang tampil saat ini.\nAktifkan layer pelanggan dan pastikan ada marker yang muncul.');
        return;
    }

    const bulanNames  = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                         'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const filterParts = [];
    if (period.bulan) filterParts.push(bulanNames[period.bulan]);
    if (period.tahun) filterParts.push(String(period.tahun));
    if (activeAddr)   filterParts.push(activeAddr.replace(/[\s\/\\]+/g, '_'));
    if (activeBlok && activeBlok !== 'NON_PELANGGAN') filterParts.push('blok' + activeBlok);
    if (catFilters.usage  !== 'all') filterParts.push(catFilters.usage);
    if (catFilters.status !== 'all') filterParts.push(catFilters.status);

    const filenameBase = filterParts.length > 0
        ? `pelanggan_${filterParts.join('_')}`
        : 'pelanggan';

    const filename   = downloadCSV(filteredData, filenameBase);
    const filterDesc = filterParts.length > 0
        ? `Filter aktif: ${filterParts.join(' + ')}`
        : 'Semua data (tidak ada filter aktif)';

    alert(`✅ CSV berhasil diunduh!\nFile: ${filename}\nJumlah data: ${filteredData.length} pelanggan\n${filterDesc}`);
}

// ── Fix Koordinat ─────────────────────────────────────────────────────────────

let fixKoordMode        = false;
let selectedNosambungan = null;

function startFixKoordMode(nosambungan) {
    selectedNosambungan = nosambungan;
    if (!nosambungan) {
        updateFixKoordInfo(null);
        return;
    }

    const map = getMap();
    if (!map) return;

    const p     = getPelangganData().find(d => d.nosambungan === nosambungan);
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

                getPelangganData().forEach(item => {
                    if (item.nosambungan === nosambungan) {
                        item.Lat  = lat.toFixed(7);
                        item.Long = lng.toFixed(7);
                    }
                });

                showFixKoordButton(getInvalidPelanggan());
            } catch (err) {
                console.error('[fix-koordinat] Gagal simpan:', err);
                updateFixKoordInfo('❌ Gagal menyimpan. Coba lagi.');
            }
        });
    }
}

export function toggleFixKoord() {
    toggleFixKoordPanel((nosambungan) => startFixKoordMode(nosambungan));
}

// ── Clear Layer ───────────────────────────────────────────────────────────────

export function clearPelangganLayer() {
    const map            = getMap();
    const pelangganLayer = getPelangganLayer();
    const labelLayer     = getLabelLayer();

    if (pelangganLayer) {
        if (map && map.hasLayer(pelangganLayer)) map.removeLayer(pelangganLayer);
        setPelangganLayerObj(null);
    }
    if (labelLayer) {
        if (map && map.hasLayer(labelLayer)) map.removeLayer(labelLayer);
        setLabelLayerObj(null);
    }

    clearMarkerLabelMap();
    setMarkerSpatialIndex(null);
    clearAllRowData();
    setRowSpatialIndex(null);
    clearAddedMarkers();

    offViewportChange(updateMarkerVisibility);
    const outOfBoundsFn = getOnViewportOutOfBoundsRef();
    if (outOfBoundsFn) offViewportChange(outOfBoundsFn);

    setLoadedBbox(null);
    setIsFetchingBbox(false);
    setCurrentPeriodFilter({});

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

// ── Misc ──────────────────────────────────────────────────────────────────────

export function setCurrentKecamatan(kecamatan) {
    currentKecamatan = kecamatan;
    console.log(`[pelanggan.js] Kecamatan aktif: ${kecamatan}`);
}

export function getIsDraggingEnabledPublic() {
    return getIsDraggingEnabled();
}

// Daftarkan callbacks ke state agar pelanggan-loader.js bisa pakai tanpa circular import
// Dieksekusi saat module pertama kali diload
setControlCallbacks({
    onToggle:       togglePelangganLayer,
    onDragMode:     toggleDragMode,
    onSave:         savePelangganCSV,
    onFixKoordinat: toggleFixKoord,
    onShowBuilding: () => {
        const isNowVisible = toggleBuildingLayer();
        updateShowBuildingButton(isNowVisible);
    },
});

// Re-export dari store agar modul lain yang sudah import dari pelanggan.js tetap bisa pakai
export { getPelangganData, getPelangganCount, isPelangganLayerVisible } from '../pelanggan/pelanggan-store.js';

// Re-export loadPelanggan agar entry point (app.js) tidak perlu ganti import
export { loadPelanggan } from '../pelanggan/pelanggan-loader.js';