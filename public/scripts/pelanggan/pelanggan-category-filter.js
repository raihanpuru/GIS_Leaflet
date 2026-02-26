import { getCurrentFilter as getBlokFilter } from './pelanggan-filter.js';
import { getCurrentAddressFilter } from './pelanggan-address-filter.js';

let pelangganLayerRef = null;
let allMarkers = new Map(); // Map of idpelanggan -> {marker, data}
let _markerByCoord = new Map(); // Map of "lat,lng" -> marker (untuk lookup cepat)
let currentFilters = {
    usage: 'all',
    status: 'all'
};

export function setPelangganCategoryLayerRef(layer) {
    pelangganLayerRef = layer;
    console.log('[pelanggan-category-filter] Layer reference set');
}

export function buildMarkersMap(pelangganData, layer) {
    allMarkers.clear();
    _markerByCoord.clear();

    if (!layer) {
        console.warn('[pelanggan-category-filter] No layer provided');
        return;
    }

    // Bangun lookup coord -> marker dari semua marker yang SUDAH ada di layer saat ini
    // (marker lain akan didaftarkan saat masuk viewport via registerMarker)
    layer.eachLayer(m => {
        if (m instanceof L.Marker) {
            const ll = m.getLatLng();
            const key = `${ll.lat.toFixed(7)},${ll.lng.toFixed(7)}`;
            _markerByCoord.set(key, m);
        }
    });

    // Map setiap pelanggan ke marker-nya (kalau sudah ada), atau simpan data saja
    pelangganData.forEach(data => {
        const pLat = parseFloat(data.Lat || data.latitude);
        const pLng = parseFloat(data.Long || data.longitude);
        if (isNaN(pLat) || isNaN(pLng)) return;

        const key = `${pLat.toFixed(7)},${pLng.toFixed(7)}`;
        const marker = _markerByCoord.get(key) || null;

        allMarkers.set(data.idpelanggan, { marker, data });
    });

    console.log(`[pelanggan-category-filter] Built map with ${allMarkers.size} pelanggan`);
}

// Dipanggil dari updateMarkerVisibility saat marker baru masuk viewport
export function registerMarkerForCategory(marker, pelangganData) {
    const ll = marker.getLatLng();
    const key = `${ll.lat.toFixed(7)},${ll.lng.toFixed(7)}`;

    for (const [id, entry] of allMarkers) {
        if (entry.marker) continue; // sudah terdaftar
        const pLat = parseFloat(entry.data.Lat || entry.data.latitude);
        const pLng = parseFloat(entry.data.Long || entry.data.longitude);
        const entryKey = `${pLat.toFixed(7)},${pLng.toFixed(7)}`;
        if (entryKey === key) {
            entry.marker = marker;
            _markerByCoord.set(key, marker);
            // Hide/show sudah dihandle oleh updateMarkerVisibility (pre-filter)
            // shouldShow tetap disimpan untuk referensi applyFilters berikutnya
            break;
        }
    }
}

export function filterByUsage(usageType) {
    currentFilters.usage = usageType;
    applyFilters();
}

export function filterByStatus(statusType) {
    currentFilters.status = statusType;
    applyFilters();
}

export function applyFilters() {
    if (!pelangganLayerRef) {
        console.warn('[pelanggan-category-filter] Layer reference not set');
        return { visible: 0, hidden: 0 };
    }

    const hasBlokFilter = !!getBlokFilter();
    const hasAddressFilter = !!getCurrentAddressFilter();
    const hasOtherFilter = hasBlokFilter || hasAddressFilter;

    let hiddenCount = 0;
    let visibleCount = 0;

    allMarkers.forEach((entry, idpelanggan) => {
        const { marker, data } = entry;

        let shouldShow = true;

        // Apply usage filter
        if (currentFilters.usage !== 'all') {
            const pakai = parseInt(data.pakai) || 0;
            if (currentFilters.usage === 'low' && pakai >= 20) shouldShow = false;
            else if (currentFilters.usage === 'high' && pakai < 20) shouldShow = false;
        }

        // Apply status filter
        if (shouldShow && currentFilters.status !== 'all') {
            const lunas = parseInt(data.lunas) || 0;
            if (currentFilters.status === 'lunas' && lunas !== 1) shouldShow = false;
            else if (currentFilters.status === 'belum' && lunas === 1) shouldShow = false;
        }

        entry.shouldShow = shouldShow;

        if (marker) {
            if (shouldShow) {
                // Jangan addLayer kalau filter alamat/blok sedang aktif
                // — biarkan filter itu yang decide apakah marker boleh tampil
                if (!hasOtherFilter && !pelangganLayerRef.hasLayer(marker)) {
                    pelangganLayerRef.addLayer(marker);
                }
                visibleCount++;
            } else {
                if (pelangganLayerRef.hasLayer(marker)) pelangganLayerRef.removeLayer(marker);
                hiddenCount++;
            }
        } else {
            if (shouldShow) visibleCount++; else hiddenCount++;
        }
    });

    console.log(`[pelanggan-category-filter] Filter applied: ${visibleCount} visible, ${hiddenCount} hidden`);
    return { visible: visibleCount, hidden: hiddenCount, total: allMarkers.size };
}

export function clearCategoryFilters() {
    currentFilters.usage = 'all';
    currentFilters.status = 'all';

    const hasBlokFilter = !!getBlokFilter();
    const hasAddressFilter = !!getCurrentAddressFilter();
    const hasOtherFilter = hasBlokFilter || hasAddressFilter;

    if (pelangganLayerRef && !hasOtherFilter) {
        allMarkers.forEach((entry) => {
            const { marker } = entry;
            entry.shouldShow = true;
            if (marker && !pelangganLayerRef.hasLayer(marker)) {
                pelangganLayerRef.addLayer(marker);
            }
        });
    } else {
        allMarkers.forEach((entry) => { entry.shouldShow = true; });
    }

    console.log('[pelanggan-category-filter] Filters cleared');
    return { visible: allMarkers.size, hidden: 0, total: allMarkers.size };
}

export function getCurrentFilters() {
    return { ...currentFilters };
}

export function getFilterStats() {
    return {
        visible: Array.from(allMarkers.values()).filter(e => 
            pelangganLayerRef && pelangganLayerRef.hasLayer(e.marker)
        ).length,
        total: allMarkers.size
    };
}