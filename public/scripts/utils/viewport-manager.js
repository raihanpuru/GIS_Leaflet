/**
 * viewport-manager.js
 * Central manager untuk viewport-based rendering.
 *
 * Fitur:
 * - Debounced moveend/zoomend listener (single listener, banyak subscriber)
 * - Grid-based spatial index untuk lookup O(1) per cell vs O(n) brute force
 * - Padding viewport agar marker tidak pop-in mendadak saat pan
 */

import { getMap } from '../polygon/polygon.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEBOUNCE_MS   = 180;   // ms tunggu setelah moveend sebelum render
const VIEWPORT_PAD  = 0.25;  // 25% padding bounds di semua sisi
const GRID_CELL_DEG = 0.005; // ~500m per cell pada ekuator — sesuaikan jika perlu

// ─── Internal State ──────────────────────────────────────────────────────────

let debounceTimer  = null;
let isInitialized  = false;
const subscribers  = new Set(); // callback() yang dipanggil saat viewport berubah

// Spatial grid: key = "gridX:gridY", value = array index ke `indexedItems`
let spatialGrid    = new Map();
let indexedItems   = [];       // { item, bbox: {minLat,maxLat,minLng,maxLng} }[]

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
    if (isInitialized) return;
    const map = getMap();
    if (!map) return;

    map.on('moveend zoomend', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(notifySubscribers, DEBOUNCE_MS);
    });

    isInitialized = true;
    console.log('[viewport-manager] Initialized');
}

function notifySubscribers() {
    subscribers.forEach(cb => {
        try { cb(); } catch(e) { console.error('[viewport-manager] Subscriber error:', e); }
    });
}

// ─── Public: Subscribe / Unsubscribe ─────────────────────────────────────────

/**
 * Daftarkan callback yang akan dipanggil setiap kali viewport berubah (debounced).
 * @param {Function} callback
 */
export function onViewportChange(callback) {
    init();
    subscribers.add(callback);
}

export function offViewportChange(callback) {
    subscribers.delete(callback);
}

// ─── Public: Viewport Bounds ─────────────────────────────────────────────────

/**
 * Ambil current map bounds dengan padding.
 * @returns {L.LatLngBounds|null}
 */
export function getPaddedBounds() {
    const map = getMap();
    if (!map) return null;
    return map.getBounds().pad(VIEWPORT_PAD);
}

/**
 * Cek apakah latlng ada di dalam padded viewport.
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean}
 */
export function isInViewport(lat, lng) {
    const bounds = getPaddedBounds();
    if (!bounds) return true; // fallback: tampilkan semua
    return bounds.contains([lat, lng]);
}

/**
 * Cek apakah bbox overlap dengan padded viewport.
 * @param {{minLat, maxLat, minLng, maxLng}} bbox
 * @returns {boolean}
 */
export function isBboxInViewport(bbox) {
    const bounds = getPaddedBounds();
    if (!bounds || !bbox) return true;

    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLng = bounds.getWest();
    const maxLng = bounds.getEast();

    // AABB overlap test
    if (bbox.maxLat < minLat || bbox.minLat > maxLat) return false;
    if (bbox.maxLng < minLng || bbox.minLng > maxLng) return false;
    return true;
}

// ─── Spatial Grid Index ───────────────────────────────────────────────────────

function latToGrid(lat)  { return Math.floor(lat  / GRID_CELL_DEG); }
function lngToGrid(lng)  { return Math.floor(lng  / GRID_CELL_DEG); }
function cellKey(gx, gy) { return `${gx}:${gy}`; }

/**
 * Build spatial grid index dari array item yang memiliki properti lat/lng.
 * Dipakai untuk query marker cepat (label pelanggan, dll).
 *
 * @param {Array} items          - array data asli
 * @param {Function} getLatLng   - fn(item) => {lat, lng}
 * @returns {Object}             - gridIndex yang bisa dipakai di queryGrid()
 */
export function buildSpatialIndex(items, getLatLng) {
    const grid = new Map();
    const indexed = [];

    items.forEach((item, i) => {
        const { lat, lng } = getLatLng(item);
        if (isNaN(lat) || isNaN(lng)) return;

        const gx = latToGrid(lat);
        const gy = lngToGrid(lng);
        const key = cellKey(gx, gy);

        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);

        indexed.push({ item, lat, lng });
    });

    console.log(`[viewport-manager] Spatial index built: ${indexed.length} items, ${grid.size} cells`);
    return { grid, indexed };
}

/**
 * Query spatial index — kembalikan items yang ada di dalam bounds.
 *
 * @param {{ grid: Map, indexed: Array }} spatialIndex
 * @param {L.LatLngBounds} bounds   - padded viewport bounds
 * @returns {Array}                 - array of original items yang ada di viewport
 */
export function queryGrid(spatialIndex, bounds) {
    if (!spatialIndex || !bounds) return spatialIndex?.indexed.map(x => x.item) ?? [];

    const { grid, indexed } = spatialIndex;

    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLng = bounds.getWest();
    const maxLng = bounds.getEast();

    const minGx = latToGrid(minLat);
    const maxGx = latToGrid(maxLat);
    const minGy = lngToGrid(minLng);
    const maxGy = lngToGrid(maxLng);

    const result = [];
    const seen   = new Set();

    for (let gx = minGx; gx <= maxGx; gx++) {
        for (let gy = minGy; gy <= maxGy; gy++) {
            const key = cellKey(gx, gy);
            const indices = grid.get(key);
            if (!indices) continue;

            indices.forEach(i => {
                if (seen.has(i)) return;
                seen.add(i);

                const { item, lat, lng } = indexed[i];
                // Fine-grained check dalam cell
                if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
                    result.push(item);
                }
            });
        }
    }

    return result;
}

/**
 * Build spatial index khusus untuk bbox-based items (bangunan GeoJSON).
 * Mendaftarkan item ke semua grid cell yang di-overlap oleh bboxnya.
 *
 * @param {Array} items          - array data asli dengan property bbox
 * @param {Function} getBbox     - fn(item) => {minLat, maxLat, minLng, maxLng} | null
 * @returns {Object}             - bboxIndex untuk queryBboxGrid()
 */
export function buildBboxIndex(items, getBbox) {
    const grid    = new Map();
    const indexed = [];

    items.forEach((item, i) => {
        const bbox = getBbox(item);
        indexed.push({ item, bbox });

        if (!bbox) return;

        const minGx = latToGrid(bbox.minLat);
        const maxGx = latToGrid(bbox.maxLat);
        const minGy = lngToGrid(bbox.minLng);
        const maxGy = lngToGrid(bbox.maxLng);

        for (let gx = minGx; gx <= maxGx; gx++) {
            for (let gy = minGy; gy <= maxGy; gy++) {
                const key = cellKey(gx, gy);
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(i);
            }
        }
    });

    console.log(`[viewport-manager] BBox index built: ${indexed.length} items, ${grid.size} cells`);
    return { grid, indexed };
}

/**
 * Query bbox-based spatial index — kembalikan items yang overlap viewport.
 *
 * @param {{ grid: Map, indexed: Array }} bboxIndex
 * @param {L.LatLngBounds} bounds
 * @returns {Array}
 */
export function queryBboxGrid(bboxIndex, bounds) {
    if (!bboxIndex || !bounds) return bboxIndex?.indexed.map(x => x.item) ?? [];

    const { grid, indexed } = bboxIndex;

    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLng = bounds.getWest();
    const maxLng = bounds.getEast();

    const minGx = latToGrid(minLat);
    const maxGx = latToGrid(maxLat);
    const minGy = lngToGrid(minLng);
    const maxGy = lngToGrid(maxLng);

    const result = [];
    const seen   = new Set();

    for (let gx = minGx; gx <= maxGx; gx++) {
        for (let gy = minGy; gy <= maxGy; gy++) {
            const key = cellKey(gx, gy);
            const indices = grid.get(key);
            if (!indices) continue;

            indices.forEach(i => {
                if (seen.has(i)) return;
                seen.add(i);

                const { item, bbox } = indexed[i];
                if (!bbox) return;

                // Fine-grained AABB overlap
                if (bbox.maxLat < minLat || bbox.minLat > maxLat) return;
                if (bbox.maxLng < minLng || bbox.minLng > maxLng) return;
                result.push(item);
            });
        }
    }

    return result;
}