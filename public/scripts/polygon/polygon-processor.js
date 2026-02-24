import { categories, getCategory, isBuilding } from '../polygon/kategori.js';
import { getPelangganForBuilding } from '../pelanggan/building-pelanggan-matcher.js';
import { getStyle, createPopupContent, pointToLayer } from '../components/polygon-ui.js';

// Canvas renderer global — jauh lebih ringan dari SVG untuk ribuan polygon
const canvasRenderer = L.canvas({ padding: 0.5 });

export function processAreas(areas, currentLayers) {
    areas.forEach(feature => {
        const category = getCategory(feature.properties);
        categories[category].count++;

        const layer = L.geoJSON(feature, {
            renderer: canvasRenderer,
            style: getStyle(category, false, false),
            pointToLayer: pointToLayer,
            onEachFeature: function(feature, layer) {
                const bounds = layer.getBounds();
                const center = bounds.getCenter();
                const popupContent = createPopupContent(feature, category, center, []);
                layer.bindPopup(popupContent);
            }
        });

        currentLayers[category].addLayer(layer);
    });
}

export function prepareBuildingFeatures(buildings, pelangganData = null) {
    let buildingWithPelangganCount = 0;
    const prepared = [];

    buildings.forEach(feature => {
        const category = getCategory(feature.properties);
        categories[category].count++;

        const pelangganList = pelangganData ? getPelangganForBuilding(feature, pelangganData) : [];
        const hasPelanggan = pelangganList.length > 0;
        if (hasPelanggan) buildingWithPelangganCount++;

        // Hitung bounding box feature sekali saja untuk perbandingan viewport nanti
        let bbox = null;
        try {
            const tmp = L.geoJSON(feature);
            const b = tmp.getBounds();
            bbox = {
                minLat: b.getSouth(), maxLat: b.getNorth(),
                minLng: b.getWest(),  maxLng: b.getEast()
            };
        } catch(e) { /* point feature, skip */ }

        prepared.push({ feature, category, pelangganList, hasPelanggan, bbox });
    });

    return { prepared, buildingWithPelangganCount };
}

export function createBuildingLayerFromPrepared({ feature, category, pelangganList, hasPelanggan }) {
    let popupContent = null; // dihitung sekali saat pertama klik

    const geoLayer = L.geoJSON(feature, {
        renderer: canvasRenderer,
        style: getStyle(category, true, hasPelanggan),
        pointToLayer: pointToLayer,
        onEachFeature: function(feat, l) {
            // Bind popup kosong dulu — supaya Leaflet canvas hit-test aktif
            l.bindPopup('');

            l.on('click', function(e) {
                // Hitung content hanya sekali, lalu reuse
                if (!popupContent) {
                    let center = null;
                    try { center = l.getBounds().getCenter(); } catch(e) {}
                    popupContent = createPopupContent(feat, category, center, pelangganList);
                }
                l.setPopupContent(popupContent);
                l.openPopup();
            });
        }
    });

    return geoLayer;
}

// Backward-compat: dipakai jika ada kode lain yang masih panggil processBuildings
export function processBuildings(buildings, currentLayers, pelangganData = null, targetLayerGroup = null) {
    const { prepared, buildingWithPelangganCount } = prepareBuildingFeatures(buildings, pelangganData);

    prepared.forEach(item => {
        const layer = createBuildingLayerFromPrepared(item);
        if (targetLayerGroup) {
            targetLayerGroup.addLayer(layer);
        } else {
            currentLayers[item.category].addLayer(layer);
        }
    });

    return buildingWithPelangganCount;
}

export function separateFeaturesIntoAreasAndBuildings(features) {
    const areas = [];
    const buildings = [];
    features.forEach(feature => {
        if (isBuilding(feature.properties)) {
            buildings.push(feature);
        } else {
            areas.push(feature);
        }
    });
    return { areas, buildings };
}