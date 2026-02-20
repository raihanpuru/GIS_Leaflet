let pelangganLayerRef = null;
let allMarkers = new Map(); // Map of idpelanggan -> {marker, labelMarker, data}
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
    
    if (!layer) {
        console.warn('[pelanggan-category-filter] No layer provided');
        return;
    }
    
    const markers = [];
    const labels = [];
    
    layer.eachLayer(marker => {
        if (marker instanceof L.Marker && marker.options.icon) {
            const markerLatLng = marker.getLatLng();
            
            // Determine if this is a pin marker or label marker
            const isLabel = marker.options.icon.options && 
                          marker.options.icon.options.iconSize && 
                          marker.options.icon.options.iconSize[0] === 0;
            
            if (isLabel) {
                labels.push({ marker, lat: markerLatLng.lat, lng: markerLatLng.lng });
            } else {
                markers.push({ marker, lat: markerLatLng.lat, lng: markerLatLng.lng });
            }
        }
    });
    
    // Match markers with data
    pelangganData.forEach(data => {
        const pLat = parseFloat(data.Lat);
        const pLng = parseFloat(data.Long);
        
        // Find matching pin marker
        const markerEntry = markers.find(m => 
            Math.abs(m.lat - pLat) < 0.000001 && 
            Math.abs(m.lng - pLng) < 0.000001
        );
        
        // Find matching label marker
        const labelEntry = labels.find(l => 
            Math.abs(l.lat - pLat) < 0.000001 && 
            Math.abs(l.lng - pLng) < 0.000001
        );
        
        if (markerEntry) {
            allMarkers.set(data.idpelanggan, {
                marker: markerEntry.marker,
                labelMarker: labelEntry ? labelEntry.marker : null,
                data: data
            });
        }
    });
    
    console.log(`[pelanggan-category-filter] Built map with ${allMarkers.size} pelanggan`);
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
    
    let hiddenCount = 0;
    let visibleCount = 0;
    
    allMarkers.forEach((entry, idpelanggan) => {
        const { marker, labelMarker, data } = entry;
        
        let shouldShow = true;
        
        // Apply usage filter
        if (currentFilters.usage !== 'all') {
            const pakai = parseInt(data.pakai) || 0;
            
            if (currentFilters.usage === 'low' && pakai >= 20) {
                shouldShow = false;
            } else if (currentFilters.usage === 'high' && pakai < 20) {
                shouldShow = false;
            }
        }
        
        // Apply status filter
        if (shouldShow && currentFilters.status !== 'all') {
            const lunas = parseInt(data.lunas) || 0;
            
            if (currentFilters.status === 'lunas' && lunas !== 1) {
                shouldShow = false;
            } else if (currentFilters.status === 'belum' && lunas === 1) {
                shouldShow = false;
            }
        }
        
        // Show/hide markers
        if (shouldShow) {
            if (marker && !pelangganLayerRef.hasLayer(marker)) {
                pelangganLayerRef.addLayer(marker);
            }
            if (labelMarker && !pelangganLayerRef.hasLayer(labelMarker)) {
                pelangganLayerRef.addLayer(labelMarker);
            }
            visibleCount++;
        } else {
            if (marker && pelangganLayerRef.hasLayer(marker)) {
                pelangganLayerRef.removeLayer(marker);
            }
            if (labelMarker && pelangganLayerRef.hasLayer(labelMarker)) {
                pelangganLayerRef.removeLayer(labelMarker);
            }
            hiddenCount++;
        }
    });
    
    console.log(`[pelanggan-category-filter] Filter applied: ${visibleCount} visible, ${hiddenCount} hidden`);
    
    return { visible: visibleCount, hidden: hiddenCount, total: allMarkers.size };
}

export function clearCategoryFilters() {
    currentFilters.usage = 'all';
    currentFilters.status = 'all';
    
    // Show all markers
    if (pelangganLayerRef) {
        allMarkers.forEach((entry) => {
            const { marker, labelMarker } = entry;
            if (marker && !pelangganLayerRef.hasLayer(marker)) {
                pelangganLayerRef.addLayer(marker);
            }
            if (labelMarker && !pelangganLayerRef.hasLayer(labelMarker)) {
                pelangganLayerRef.addLayer(labelMarker);
            }
        });
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