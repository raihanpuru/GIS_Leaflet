/**
 * pelanggan-marker.js
 * Tanggung jawab:
 *   - Membuat marker & label pelanggan (createPelangganMarker)
 *   - Viewport culling: updateMarkerVisibility, updateLabelVisibility
 *   - Rebuild spatial index setelah marker bergerak
 */

import { getMap }                     from '../polygon/polygon.js';
import { updateBuildingsWithPelanggan } from '../polygon/polygon.js';
import {
    PIN_ICON, SAVING_ICON, ERROR_ICON,
    buildPopup, buildLabel, updateLegend
}                                     from '../components/pelanggan-ui.js';
import { pelangganAPI }               from '../api/pelanggan-api.js';
import { getPelangganData } from '../pelanggan/pelanggan-store.js';
import {
    getCurrentFilter  as getBlokFilter,
    getAllMarkersSnapshot,
    addToMarkersSnapshot
}                                     from '../pelanggan/pelanggan-filter.js';
import {
    getCurrentFilters as getCategoryFilters,
    registerMarkerForCategory
}                                     from '../pelanggan/pelanggan-category-filter.js';
import { getCurrentAddressFilter, getAddressGroups } from '../pelanggan/pelanggan-address-filter.js';
import { buildAddressLookup, matchesByGroup } from '../pelanggan/pelanggan-address-grouper.js';
import { getPaddedBounds, buildSpatialIndex, queryGrid } from '../utils/viewport-manager.js';
import { showLoading, hideLoading }   from '../utils/loading.js';
import {
    getPelangganLayer, getLabelLayer,
    getMarkerLabelMap, setMarkerLabel, getMarkerLabel,
    getAllRowData, pushRowData,
    getRowSpatialIndex,  setRowSpatialIndex,
    getMarkerSpatialIndex, setMarkerSpatialIndex,
    getAddedMarkers, getIsDraggingEnabled
}                                     from '../pelanggan/pelanggan-layer-state.js';

// ── Rebuild Spatial Indices ───────────────────────────────────────────────────

export function rebuildSpatialIndices() {
    const allRowData = getAllRowData();
    setRowSpatialIndex(buildSpatialIndex(allRowData, entry => ({
        lat: parseFloat(entry.row['Lat']),
        lng: parseFloat(entry.row['Long'])
    })));

    const markerArray = [];
    getMarkerLabelMap().forEach((_, m) => markerArray.push(m));
    setMarkerSpatialIndex(buildSpatialIndex(markerArray, m => {
        const ll = m.getLatLng();
        return { lat: ll.lat, lng: ll.lng };
    }));
}

// ── Viewport Culling ──────────────────────────────────────────────────────────

export function updateMarkerVisibility() {
    const pelangganLayer = getPelangganLayer();
    const labelLayer     = getLabelLayer();
    if (!pelangganLayer || !labelLayer) return;
    const map = getMap();
    if (!map) return;

    const bounds = getPaddedBounds();
    if (!bounds) return;

    const allRowData    = getAllRowData();
    const addedMarkers  = getAddedMarkers();
    const rowSpatialIdx = getRowSpatialIndex();

    const rowsInViewport = rowSpatialIdx
        ? new Set(queryGrid(rowSpatialIdx, bounds))
        : new Set(allRowData);

    const toAdd    = [];
    const toRemove = [];

    allRowData.forEach(entry => {
        const inViewport = rowsInViewport.has(entry);
        const isAdded    = addedMarkers.has(entry);
        if (inViewport && !isAdded)  toAdd.push(entry);
        else if (!inViewport && isAdded) toRemove.push(entry);
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

        const toAddVisible = [];
        toAdd.forEach(entry => {
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

        pelangganLayer.addLayers(toAddVisible.map(e => e.marker));
        // Tandai semua (termasuk yang difilter) agar viewport culling tidak re-add
        toAdd.forEach(e => addedMarkers.add(e));

        addToMarkersSnapshot(toAdd.map(e => e.marker), toAdd);
        toAdd.forEach(e => registerMarkerForCategory(e.marker, getPelangganData()));
    }

    if (toAdd.length > 0 || toRemove.length > 0) {
        console.log(`[pelanggan-marker.js] Viewport update: +${toAdd.length} / -${toRemove.length} (aktif: ${getAddedMarkers().size})`);
    }

    updateLabelVisibility();
}

export function updateLabelVisibility() {
    const pelangganLayer = getPelangganLayer();
    const labelLayer     = getLabelLayer();
    if (!pelangganLayer || !labelLayer) return;
    const map = getMap();
    if (!map) return;

    const bounds            = getPaddedBounds();
    const markerSpatialIdx  = getMarkerSpatialIndex();

    let markersToCheck;
    if (markerSpatialIdx && bounds) {
        markersToCheck = queryGrid(markerSpatialIdx, bounds);
    } else {
        markersToCheck = [];
        getMarkerLabelMap().forEach((_, marker) => markersToCheck.push(marker));
    }

    // Sembunyikan semua label yang sedang visible
    const currentlyVisible = new Set();
    labelLayer.eachLayer(l => currentlyVisible.add(l));
    currentlyVisible.forEach(l => labelLayer.removeLayer(l));

    // Tampilkan hanya label yang unclustered dan dalam viewport
    markersToCheck.forEach(marker => {
        const labelMarker = getMarkerLabel(marker);
        if (!labelMarker) return;
        const visibleParent = pelangganLayer.getVisibleParent(marker);
        if (visibleParent === marker) {
            labelLayer.addLayer(labelMarker);
        }
    });
}

// ── Marker Factory ────────────────────────────────────────────────────────────

export function createPelangganMarker(row) {
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
        const data      = getPelangganData();
        const dataIndex = data.findIndex(item => item['idpelanggan'] === row['idpelanggan']);

        if (dataIndex === -1) {
            console.warn('[pelanggan-marker.js] Data tidak ditemukan untuk:', row['idpelanggan']);
            return;
        }

        // Update koordinat di memori
        const latStr0 = newLatLng.lat.toFixed(7);
        const lngStr0 = newLatLng.lng.toFixed(7);
        data[dataIndex]['Lat'] = latStr0;
        data[dataIndex]['Long'] = lngStr0;
        row['Lat']  = latStr0;
        row['Long'] = lngStr0;

        // Update entry di allRowData agar spatial index konsisten setelah marker dipindah
        const movedEntry = getAllRowData().find(e => e.marker === marker);
        if (movedEntry) {
            movedEntry.row['Lat']  = latStr0;
            movedEntry.row['Long'] = lngStr0;
        }
        rebuildSpatialIndices();

        marker.setPopupContent(buildPopup(data[dataIndex]));

        const labelMarker = getMarkerLabel(marker);
        if (labelMarker) labelMarker.setLatLng(newLatLng);

        updateBuildingsWithPelanggan(data);

        console.log(`[pelanggan-marker.js] Marker dipindahkan: ${nama} -> [${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}]`);

        // Sync ke DB via nosambungan (update semua periode sekaligus)
        const nosambungan = data[dataIndex]['nosambungan'];
        if (!nosambungan) {
            console.warn('[pelanggan-marker.js] nosambungan tidak ditemukan:', row['idpelanggan']);
            return;
        }

        const latStr = newLatLng.lat.toFixed(7);
        const lngStr = newLatLng.lng.toFixed(7);
        data.forEach(item => {
            if (item['nosambungan'] === nosambungan) {
                item['Lat']  = latStr;
                item['Long'] = lngStr;
            }
        });

        marker.setIcon(SAVING_ICON);
        showLoading('Menyimpan koordinat...');

        setTimeout(() => {
            pelangganAPI.updateCoordsByNosambungan(
                nosambungan,
                parseFloat(latStr),
                parseFloat(lngStr)
            )
            .then(result => {
                marker.setIcon(PIN_ICON);
                console.log(`[pelanggan-marker.js] Koordinat tersimpan: ${nama} (${result.affectedRows} record, nosambungan=${nosambungan})`);
            })
            .catch(err => {
                marker.setIcon(ERROR_ICON);
                console.error('[pelanggan-marker.js] Gagal sync ke DB:', err);
                setTimeout(() => marker.setIcon(PIN_ICON), 3000);
            })
            .finally(() => hideLoading());
        }, 0);
    });

    const labelMarker = L.marker([lat, lng], {
        icon: buildLabel(nama),
        interactive: false,
        zIndexOffset: -1
    });

    setMarkerLabel(marker, labelMarker);

    return { marker, labelMarker };
}