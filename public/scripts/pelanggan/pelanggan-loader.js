/**
 * pelanggan-loader.js
 * Tanggung jawab:
 *   - loadPelanggan()     — fetch awal + setup layer dari API
 *   - fetchBbox()         — incremental loading saat pan/zoom keluar area
 *   - onViewportOutOfBounds, expandLoadedBbox, isViewportCovered — helper bbox
 */

import { getMap, updateBuildingsWithPelanggan, toggleBuildingLayer } from '../polygon/polygon.js';
import { isValidCoord }                    from '../pelanggan/pelanggan-csv.js';
import { pelangganAPI, PelangganAPI }      from '../api/pelanggan-api.js';
import { updateLegend, createControlButtons, updateToggleButton } from '../components/pelanggan-ui.js';
import { updateShowBuildingButton }        from '../components/polygon-ui.js';
import { updateBlokOptions, updateAddressOptions } from '../components/pelanggan-filter-ui.js';
import { createCategoryFilterControl }     from '../components/pelanggan-category-filter-ui.js';
import {
    setPelangganLayerRef
}                                          from '../pelanggan/pelanggan-filter.js';
import {
    setPelangganCategoryLayerRef,
    buildMarkersMap,
    setRawPelangganData,
    getCurrentFilters
}                                          from '../pelanggan/pelanggan-category-filter.js';
import {
    setPelangganLayerRef as setPelangganAddressLayerRef,
    setCategoryFiltersRef
}                                          from '../pelanggan/pelanggan-address-filter.js';
import {
    getPelangganData, isPelangganLayerVisible, getPelangganCount,
    _setPelangganData, _setPelangganCount, _setIsPelangganVisible,
    getInvalidPelanggan
}                                          from '../pelanggan/pelanggan-store.js';
import {
    onViewportChange, offViewportChange,
    getPaddedBounds, buildSpatialIndex, queryGrid
}                                          from '../utils/viewport-manager.js';
import { showLoading, hideLoading }        from '../utils/loading.js';

import {
    getPelangganLayer, getLabelLayer,
    setPelangganLayerObj, setLabelLayerObj,
    clearMarkerLabelMap, getMarkerLabelMap,
    clearAllRowData, pushRowData, getAllRowData,
    setRowSpatialIndex, setMarkerSpatialIndex,
    clearAddedMarkers,
    getLoadedBbox, setLoadedBbox,
    getCurrentPeriodFilter, setCurrentPeriodFilter,
    getIsFetchingBbox, setIsFetchingBbox,
    getIsDraggingEnabled,
    getControlCallbacks,
    setOnViewportOutOfBoundsRef
}                                          from '../pelanggan/pelanggan-layer-state.js';
import { createPelangganMarker, rebuildSpatialIndices, updateMarkerVisibility, updateLabelVisibility } from '../pelanggan/pelanggan-marker.js';
import { showFixKoordButton }              from '../components/pelanggan-ui.js';

// ── Bbox Helpers ──────────────────────────────────────────────────────────────

function expandLoadedBbox(bbox) {
    const loaded = getLoadedBbox();
    if (!loaded) {
        setLoadedBbox({ ...bbox });
        return;
    }
    setLoadedBbox({
        minLng: Math.min(loaded.minLng, bbox.minLng),
        minLat: Math.min(loaded.minLat, bbox.minLat),
        maxLng: Math.max(loaded.maxLng, bbox.maxLng),
        maxLat: Math.max(loaded.maxLat, bbox.maxLat),
    });
}

function isViewportCovered() {
    const loadedBbox = getLoadedBbox();
    if (!loadedBbox) return false;
    const map = getMap();
    if (!map) return false;
    const b = map.getBounds().pad(0.1);
    return (
        b.getSouth() >= loadedBbox.minLat &&
        b.getNorth() <= loadedBbox.maxLat &&
        b.getWest()  >= loadedBbox.minLng &&
        b.getEast()  <= loadedBbox.maxLng
    );
}

export function onViewportOutOfBounds() {
    if (getIsFetchingBbox()) return;
    if (isViewportCovered()) return;
    fetchBbox(getCurrentPeriodFilter());
}
// Simpan referensi agar clearPelangganLayer di pelanggan.js bisa off-kan tanpa circular import
setOnViewportOutOfBoundsRef(onViewportOutOfBounds);

// ── Incremental Bbox Fetch ────────────────────────────────────────────────────

export function fetchBbox(periodFilter = {}) {
    const map = getMap();
    if (!map || getIsFetchingBbox()) return;

    const b    = map.getBounds().pad(0.3);
    const bbox = {
        minLng: b.getWest(),
        minLat: b.getSouth(),
        maxLng: b.getEast(),
        maxLat: b.getNorth(),
    };
    const bboxStr = `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;

    const filterParams = { bbox: bboxStr };
    if (periodFilter.bulan) filterParams.bulan = periodFilter.bulan;
    if (periodFilter.tahun) filterParams.tahun = periodFilter.tahun;

    const params = new URLSearchParams(filterParams).toString();
    const url    = `/api/pelanggan${params ? '?' + params : ''}`;

    setIsFetchingBbox(true);
    console.log('[pelanggan-loader.js] Fetch bbox:', bboxStr);

    fetch(url)
        .then(res => {
            if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Gagal fetch pelanggan'); });
            return res.json();
        })
        .then(async response => {
            if (!response.success) throw new Error('API gagal: ' + (response.error || 'Unknown error'));

            const newRows    = PelangganAPI.toLegacyFormat(response.data);
            const existingIds = new Set(getPelangganData().map(r => r._db_id));
            const toAdd      = newRows.filter(r => !existingIds.has(r._db_id));

            if (toAdd.length === 0) {
                expandLoadedBbox(bbox);
                console.log('[pelanggan-loader.js] Tidak ada data baru di bbox ini');
                return;
            }

            const merged = [...getPelangganData(), ...toAdd];
            _setPelangganData(merged);
            _setPelangganCount(merged.filter(r => r.Lat && r.Long).length);
            setRawPelangganData(merged);

            // Buat marker untuk data baru saja (chunked)
            let added = 0;
            await new Promise(resolve => {
                const CHUNK = 200;
                let i = 0;
                function processChunk() {
                    const end = Math.min(i + CHUNK, toAdd.length);
                    for (; i < end; i++) {
                        const row = toAdd[i];
                        if (!isValidCoord(row)) continue;
                        const { marker, labelMarker } = createPelangganMarker(row);
                        pushRowData({ row, marker, labelMarker });
                        added++;
                    }
                    if (i < toAdd.length) setTimeout(processChunk, 0);
                    else resolve();
                }
                processChunk();
            });

            rebuildSpatialIndices();
            expandLoadedBbox(bbox);
            updateLegend(getPelangganCount(), getIsDraggingEnabled());
            updateMarkerVisibility();

            console.log(`[pelanggan-loader.js] +${added} marker baru, total: ${getAllRowData().length}`);
        })
        .catch(err => {
            console.error('[pelanggan-loader.js] Gagal fetch bbox:', err);
        })
        .finally(() => {
            setIsFetchingBbox(false);
        });
}

// ── Initial Load ──────────────────────────────────────────────────────────────

export function loadPelanggan(periodFilter = {}) {
    const map = getMap();
    if (!map) {
        console.error('[pelanggan-loader.js] Map belum diinisialisasi. Pastikan polygon.js diload dulu.');
        return;
    }

    // Reset state bbox saat ganti periode
    setLoadedBbox(null);
    setCurrentPeriodFilter(periodFilter);

    const filterParams = {};
    if (periodFilter.bulan) filterParams.bulan = periodFilter.bulan;
    if (periodFilter.tahun) filterParams.tahun = periodFilter.tahun;

    const b = map.getBounds().pad(0.3);
    filterParams.bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;

    console.log('[pelanggan-loader.js] Mengambil data pelanggan dari API dengan filter:', filterParams);

    const params = new URLSearchParams(filterParams).toString();
    const url    = `/api/pelanggan${params ? '?' + params : ''}`;

    fetch(url)
        .then(res => {
            if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Gagal fetch pelanggan'); });
            return res.json();
        })
        .then(async response => {
            if (!response.success) throw new Error('API gagal: ' + (response.error || 'Unknown error'));

            // Bersihkan layer lama
            const pelangganLayer = getPelangganLayer();
            const labelLayer     = getLabelLayer();
            if (pelangganLayer && map.hasLayer(pelangganLayer)) map.removeLayer(pelangganLayer);
            if (labelLayer     && map.hasLayer(labelLayer))     map.removeLayer(labelLayer);
            clearMarkerLabelMap();

            const rows = PelangganAPI.toLegacyFormat(response.data);
            _setPelangganData(rows);

            const newPelangganLayer = L.markerClusterGroup({
                disableClusteringAtZoom: 18,
                maxClusterRadius: 60,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
            });
            newPelangganLayer.on('animationend', updateLabelVisibility);
            setPelangganLayerObj(newPelangganLayer);

            const newLabelLayer = L.layerGroup();
            setLabelLayerObj(newLabelLayer);

            offViewportChange(updateMarkerVisibility);
            offViewportChange(onViewportOutOfBounds);
            onViewportChange(updateMarkerVisibility);
            onViewportChange(onViewportOutOfBounds);

            clearAllRowData();
            clearAddedMarkers();
            clearMarkerLabelMap();

            let count   = 0;
            let skipped = 0;

            // Chunked processing agar main thread tidak freeze
            await new Promise(resolve => {
                const CHUNK_SIZE = 200;
                let i = 0;
                function processChunk() {
                    const end = Math.min(i + CHUNK_SIZE, rows.length);
                    for (; i < end; i++) {
                        const row = rows[i];
                        if (!isValidCoord(row)) {
                            skipped++;
                            console.warn('[pelanggan-loader.js] Koordinat tidak valid, skipped:',
                                row['idpelanggan'], row['nama'],
                                '| Lat:', row['Lat'], 'Long:', row['Long']);
                            continue;
                        }
                        const { marker, labelMarker } = createPelangganMarker(row);
                        pushRowData({ row, marker, labelMarker });
                        count++;
                    }
                    if (i < rows.length) setTimeout(processChunk, 0);
                    else resolve();
                }
                processChunk();
            });

            _setPelangganCount(count);
            rebuildSpatialIndices();
            console.log(`[pelanggan-loader.js] Spatial index built untuk ${count} marker`);

            // Catat bbox awal yang sudah di-load
            const initBounds = map.getBounds().pad(0.3);
            expandLoadedBbox({
                minLng: initBounds.getWest(), minLat: initBounds.getSouth(),
                maxLng: initBounds.getEast(), maxLat: initBounds.getNorth(),
            });

            if (isPelangganLayerVisible()) {
                getPelangganLayer().addTo(map);
                getLabelLayer().addTo(map);
                updateMarkerVisibility();
            }

            if (!document.getElementById('togglePelanggan')) {
                _addControlButtons();
            }

            updateLegend(getPelangganCount(), getIsDraggingEnabled());

            setPelangganLayerRef(getPelangganLayer());
            setPelangganAddressLayerRef(getPelangganLayer());
            setCategoryFiltersRef(getCurrentFilters);

            if (!document.querySelector('.pelanggan-category-filter-control')) {
                const categoryFilterControl = createCategoryFilterControl();
                categoryFilterControl.addTo(map);
            }

            setPelangganCategoryLayerRef(getPelangganLayer());
            buildMarkersMap(getPelangganData(), getPelangganLayer());
            setRawPelangganData(getPelangganData());

            updateBuildingsWithPelanggan(getPelangganData());
            updateBlokOptions();
            updateAddressOptions();

            showFixKoordButton(getInvalidPelanggan());

            console.log(`[pelanggan-loader.js] Berhasil load ${getPelangganCount()} pelanggan dari DB.` +
                (skipped ? ` (${skipped} baris di-skip karena koordinat tidak valid)` : ''));
        })
        .catch(err => {
            console.error('[pelanggan-loader.js] Gagal load dari API:', err);
            alert('Gagal mengambil data pelanggan dari server.\nPastikan backend berjalan dan database terhubung.\n\nError: ' + err.message);
        })
        .finally(() => {
            hideLoading();
        });
}

function _addControlButtons() {
    const map = getMap();
    if (!map) return;

    const cb = getControlCallbacks();
    const control = createControlButtons({
        onToggle:       cb.onToggle,
        onDragMode:     cb.onDragMode,
        onSave:         cb.onSave,
        onFixKoordinat: cb.onFixKoordinat,
        onShowBuilding: cb.onShowBuilding,
    });
    control.addTo(map);
}