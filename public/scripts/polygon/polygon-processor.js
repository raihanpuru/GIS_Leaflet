import { categories, getCategory, isBuilding } from '../polygon/kategori.js';
import { getPelangganForBuilding } from '../pelanggan/building-pelanggan-matcher.js';
import { getStyle, createPopupContent, pointToLayer } from '../components/polygon-ui.js';

export function processAreas(areas, currentLayers) {
    areas.forEach(feature => {
        const category = getCategory(feature.properties);
        categories[category].count++;

        const layer = L.geoJSON(feature, {
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

export function processBuildings(buildings, currentLayers, pelangganData = null, targetLayerGroup = null) {
    let buildingWithPelangganCount = 0;
    
    buildings.forEach(feature => {
        const category = getCategory(feature.properties);
        categories[category].count++;

        const pelangganList = pelangganData ? 
            getPelangganForBuilding(feature, pelangganData) : [];
        const hasPelanggan = pelangganList.length > 0;
        
        if (hasPelanggan) {
            buildingWithPelangganCount++;
        }

        const layer = L.geoJSON(feature, {
            style: getStyle(category, true, hasPelanggan),
            pointToLayer: pointToLayer,
            onEachFeature: function(feature, layer) {
                const bounds = layer.getBounds();
                const center = bounds.getCenter();
                const popupContent = createPopupContent(feature, category, center, pelangganList);
                layer.bindPopup(popupContent);
            }
        });

        // Jika ada targetLayerGroup, masukkan building ke sana (bukan ke currentLayers)
        if (targetLayerGroup) {
            targetLayerGroup.addLayer(layer);
        } else {
            currentLayers[category].addLayer(layer);
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