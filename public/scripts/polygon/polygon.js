import { categories } from '../polygon/kategori.js';
import { clearBuildingPelangganMap } from '../pelanggan/building-pelanggan-matcher.js';
import { createLegendControl, createLayerControl, updateBuildingCountDisplay, updatePelangganBuildingCount, updateShowBuildingButton } from '../components/polygon-ui.js';
import { processAreas, processBuildings, separateFeaturesIntoAreasAndBuildings } from '../polygon/polygon-processor.js';

const map = L.map('map').setView([-7.428, 112.72], 12);

export function getMap() {
    return map;
}

export function getCurrentGeojsonData() {
    return currentGeojsonData;
}

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20
}).addTo(map);

let currentLayers = {};
let currentLegend = null;
let currentLayerControl = null;
let currentPelangganData = null; 
let currentGeojsonData = null;
let buildingLayerGroup = null;
let buildingVisible = false;

export function isBuildingVisible() {
    return buildingVisible;
}

export function toggleBuildingLayer() {
    if (!buildingLayerGroup) return;
    
    if (buildingVisible) {
        map.removeLayer(buildingLayerGroup);
        buildingVisible = false;
    } else {
        buildingLayerGroup.addTo(map);
        buildingVisible = true;
    }
    return buildingVisible;
}

export function clearMap() {
    Object.keys(currentLayers).forEach(cat => {
        if (currentLayers[cat]) {
            map.removeLayer(currentLayers[cat]);
        }
    });
    currentLayers = {};
    
    if (buildingLayerGroup) {
        map.removeLayer(buildingLayerGroup);
        buildingLayerGroup = null;
    }
    buildingVisible = false;
    
    if (currentLegend) {
        map.removeControl(currentLegend);
        currentLegend = null;
    }
    
    if (currentLayerControl) {
        map.removeControl(currentLayerControl);
        currentLayerControl = null;
    }
    
    Object.keys(categories).forEach(cat => {
        categories[cat].count = 0;
    });
    
    clearBuildingPelangganMap();
}

export function loadGeoJSON(kecamatan) {
    clearMap();

    // Ambil dari API (data tersimpan di MySQL), bukan file statis
    const apiUrl = `/api/bangunan/${kecamatan}`;

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || `Gagal mengambil data: ${apiUrl}`);
                });
            }
            return response.json();
        })
        .then(data => {
            currentGeojsonData = data; 
            
            Object.keys(categories).forEach(cat => {
                currentLayers[cat] = L.layerGroup().addTo(map);
            });

            const { areas, buildings } = separateFeaturesIntoAreasAndBuildings(data.features);
            processAreas(areas, currentLayers);
            
            // Building disimpan tapi belum ditampilkan
            buildingLayerGroup = L.layerGroup();
            buildingVisible = false;
            processBuildings(buildings, currentLayers, currentPelangganData, buildingLayerGroup);
            
            // Update tombol show building
            updateShowBuildingButton(false, buildings.length);
            
            currentLegend = createLegendControl();
            currentLegend.addTo(map);

            const kecamatanName = kecamatan.charAt(0).toUpperCase() + kecamatan.slice(1);
            updateBuildingCountDisplay(kecamatanName, buildings.length);

            const bounds = L.geoJSON(data).getBounds();
            const center = bounds.getCenter();
            map.setView(center, 13);

            currentLayerControl = createLayerControl(currentLayers);
            currentLayerControl.addTo(map);
        })
        .catch(error => {
            console.error('Error loading GeoJSON:', error);
            alert(`Gagal memuat data untuk kecamatan: ${kecamatan}\n${error.message}`);
        });
}

export function updateBuildingsWithPelanggan(pelangganData) {
    currentPelangganData = pelangganData;
    
    if (!currentGeojsonData) {
        console.warn('[polygon.js] GeoJSON belum dimuat, tidak bisa update bangunan');
        return;
    }
    
    Object.keys(currentLayers).forEach(cat => {
        if (currentLayers[cat]) {
            map.removeLayer(currentLayers[cat]);
        }
    });
    
    Object.keys(categories).forEach(cat => {
        currentLayers[cat] = L.layerGroup().addTo(map);
        categories[cat].count = 0;
    });
    
    const { areas, buildings } = separateFeaturesIntoAreasAndBuildings(currentGeojsonData.features);
    
    // Reset building layer group
    if (buildingLayerGroup) {
        map.removeLayer(buildingLayerGroup);
    }
    buildingLayerGroup = L.layerGroup();
    buildingVisible = false;
    
    processAreas(areas, currentLayers);
    const buildingWithPelangganCount = processBuildings(buildings, currentLayers, currentPelangganData, buildingLayerGroup);
    updatePelangganBuildingCount(buildingWithPelangganCount);
    updateShowBuildingButton(false, buildings.length);
    
    console.log(`[polygon.js] Updated buildings: ${buildingWithPelangganCount} bangunan memiliki pelanggan`);
}