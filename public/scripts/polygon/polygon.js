import { categories } from '../polygon/kategori.js';
import { clearBuildingPelangganMap } from '../pelanggan/building-pelanggan-matcher.js';
import { createLegendControl, createLayerControl, updateBuildingCountDisplay, updatePelangganBuildingCount, updateShowBuildingButton } from '../components/polygon-ui.js';
import { processAreas, prepareBuildingFeatures, createBuildingLayerFromPrepared, separateFeaturesIntoAreasAndBuildings } from '../polygon/polygon-processor.js';

const map = L.map('map').setView([-7.428, 112.72], 12);

export function getMap() { return map; }
export function getCurrentGeojsonData() { return currentGeojsonData; }

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20
}).addTo(map);

// ─── State ───────────────────────────────────────────────────────────────────
let currentLayers        = {};
let currentLegend        = null;
let currentLayerControl  = null;
let currentPelangganData = null;
let currentGeojsonData   = null;
let buildingVisible      = false;

// Viewport rendering state
let allPreparedBuildings = [];   // semua building sudah di-preprocess (bbox dihitung)
let buildingLayerGroup   = null; // di-init saat pertama dipakai, bukan di level module
let viewportRenderTimer  = null; // debounce timer

export function isBuildingVisible() { return buildingVisible; }

// ─── Viewport Rendering ──────────────────────────────────────────────────────

function renderBuildingsInViewport() {
    if (!buildingVisible || allPreparedBuildings.length === 0) return;

    buildingLayerGroup.clearLayers();

    const bounds = map.getBounds().pad(0.15); // 15% padding supaya tidak pop-in tiba-tiba
    const minLat = bounds.getSouth(), maxLat = bounds.getNorth();
    const minLng = bounds.getWest(),  maxLng = bounds.getEast();

    let rendered = 0;
    allPreparedBuildings.forEach(item => {
        // Skip jika bbox tidak overlap dengan viewport
        if (item.bbox) {
            if (item.bbox.maxLat < minLat || item.bbox.minLat > maxLat) return;
            if (item.bbox.maxLng < minLng || item.bbox.minLng > maxLng) return;
        }
        buildingLayerGroup.addLayer(createBuildingLayerFromPrepared(item));
        rendered++;
    });

    console.log(`[viewport] Rendered ${rendered} / ${allPreparedBuildings.length} buildings`);
}

function scheduleViewportRender() {
    clearTimeout(viewportRenderTimer);
    viewportRenderTimer = setTimeout(renderBuildingsInViewport, 150); // debounce 150ms
}

// Attach map events untuk viewport rendering
map.on('moveend zoomend', scheduleViewportRender);

// ─── Toggle Building ─────────────────────────────────────────────────────────
export function toggleBuildingLayer() {
    if (allPreparedBuildings.length === 0) return;

    if (buildingVisible) {
        if (buildingLayerGroup) map.removeLayer(buildingLayerGroup);
        buildingVisible = false;
    } else {
        if (!buildingLayerGroup) buildingLayerGroup = L.layerGroup();
        buildingLayerGroup.addTo(map);
        buildingVisible = true;
        renderBuildingsInViewport();
    }
    return buildingVisible;
}

// ─── Clear Map ───────────────────────────────────────────────────────────────
export function clearMap() {
    Object.keys(currentLayers).forEach(cat => {
        if (currentLayers[cat]) map.removeLayer(currentLayers[cat]);
    });
    currentLayers = {};

    if (buildingLayerGroup) {
        map.removeLayer(buildingLayerGroup);
        buildingLayerGroup = null;
    }
    allPreparedBuildings = [];
    buildingVisible = false;

    if (currentLegend)       { map.removeControl(currentLegend);       currentLegend = null; }
    if (currentLayerControl) { map.removeControl(currentLayerControl); currentLayerControl = null; }

    Object.keys(categories).forEach(cat => { categories[cat].count = 0; });
    clearBuildingPelangganMap();
}

// ─── Load GeoJSON ────────────────────────────────────────────────────────────
export function loadGeoJSON(kecamatan) {
    clearMap();

    fetch(`/api/bangunan/${kecamatan}`)
        .then(res => {
            if (!res.ok) return res.json().then(err => { throw new Error(err.error || `Gagal: ${kecamatan}`); });
            return res.json();
        })
        .then(data => {
            currentGeojsonData = data;

            Object.keys(categories).forEach(cat => {
                currentLayers[cat] = L.layerGroup().addTo(map);
            });

            const { areas, buildings } = separateFeaturesIntoAreasAndBuildings(data.features);

            // Render areas langsung (biasanya sedikit)
            processAreas(areas, currentLayers);

            // Pre-process buildings: hitung bbox & pelanggan, tapi belum render
            const { prepared, buildingWithPelangganCount } = prepareBuildingFeatures(buildings, currentPelangganData);
            allPreparedBuildings = prepared;

            updateShowBuildingButton(false, buildings.length);
            updatePelangganBuildingCount(buildingWithPelangganCount);

            currentLegend = createLegendControl();
            currentLegend.addTo(map);

            const kecamatanName = kecamatan.charAt(0).toUpperCase() + kecamatan.slice(1);
            updateBuildingCountDisplay(kecamatanName, buildings.length);

            const bounds = L.geoJSON(data).getBounds();
            map.setView(bounds.getCenter(), 13);

            currentLayerControl = createLayerControl(currentLayers);
            currentLayerControl.addTo(map);

            console.log(`[loadGeoJSON] ${buildings.length} buildings pre-processed, belum dirender.`);
        })
        .catch(error => {
            console.error('Error loading GeoJSON:', error);
            alert(`Gagal memuat data untuk kecamatan: ${kecamatan}\n${error.message}`);
        });
}

// ─── Update Buildings When Pelanggan Data Berubah ────────────────────────────
export function updateBuildingsWithPelanggan(pelangganData) {
    currentPelangganData = pelangganData;

    if (!currentGeojsonData) {
        console.warn('[polygon.js] GeoJSON belum dimuat');
        return;
    }

    // Re-render areas
    Object.keys(currentLayers).forEach(cat => {
        if (currentLayers[cat]) map.removeLayer(currentLayers[cat]);
    });
    Object.keys(categories).forEach(cat => {
        currentLayers[cat] = L.layerGroup().addTo(map);
        categories[cat].count = 0;
    });

    const { areas, buildings } = separateFeaturesIntoAreasAndBuildings(currentGeojsonData.features);
    processAreas(areas, currentLayers);

    // Re-pre-process buildings dengan data pelanggan baru
    if (buildingLayerGroup) map.removeLayer(buildingLayerGroup);
    buildingLayerGroup = null;
    buildingVisible = false;

    const { prepared, buildingWithPelangganCount } = prepareBuildingFeatures(buildings, currentPelangganData);
    allPreparedBuildings = prepared;

    updatePelangganBuildingCount(buildingWithPelangganCount);
    updateShowBuildingButton(false, buildings.length);

    console.log(`[updateBuildingsWithPelanggan] ${buildingWithPelangganCount} bangunan punya pelanggan`);
}