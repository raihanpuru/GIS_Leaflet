/**
 * pelanggan-layer-state.js
 * Shared mutable state untuk layer objects dan viewport culling data.
 * Dipisahkan agar tidak terjadi circular dependency antar modul.
 */

// ── Layer References ──────────────────────────────────────────────────────────
let _pelangganLayer = null;
let _labelLayer     = null;

export function getPelangganLayer()         { return _pelangganLayer; }
export function getLabelLayer()             { return _labelLayer; }
export function setPelangganLayerObj(layer) { _pelangganLayer = layer; }
export function setLabelLayerObj(layer)     { _labelLayer = layer; }

// ── Marker ↔ Label Map ────────────────────────────────────────────────────────
// key: marker instance, value: labelMarker instance
const markerLabelMap = new Map();

export function getMarkerLabelMap()                      { return markerLabelMap; }
export function setMarkerLabel(marker, label)            { markerLabelMap.set(marker, label); }
export function getMarkerLabel(marker)                   { return markerLabelMap.get(marker); }
export function clearMarkerLabelMap()                    { markerLabelMap.clear(); }

// ── Viewport Culling State ────────────────────────────────────────────────────
let _allRowData        = [];   // { row, marker, labelMarker }[]
let _rowSpatialIndex   = null;
let _markerSpatialIndex = null;
const _addedMarkers    = new Set(); // entry objects yang sudah di-add ke cluster

export function getAllRowData()                        { return _allRowData; }
export function setAllRowData(data)                   { _allRowData = data; }
export function pushRowData(entry)                    { _allRowData.push(entry); }
export function clearAllRowData()                     { _allRowData = []; }

export function getRowSpatialIndex()                  { return _rowSpatialIndex; }
export function setRowSpatialIndex(idx)               { _rowSpatialIndex = idx; }

export function getMarkerSpatialIndex()               { return _markerSpatialIndex; }
export function setMarkerSpatialIndex(idx)            { _markerSpatialIndex = idx; }

export function getAddedMarkers()                     { return _addedMarkers; }
export function clearAddedMarkers()                   { _addedMarkers.clear(); }

// ── Drag Mode ─────────────────────────────────────────────────────────────────
let _isDraggingEnabled  = false;
let _detachedMarkers    = [];

export function getIsDraggingEnabled()                { return _isDraggingEnabled; }
export function setIsDraggingEnabled(val)             { _isDraggingEnabled = val; }
export function getDetachedMarkers()                  { return _detachedMarkers; }
export function setDetachedMarkers(arr)               { _detachedMarkers = arr; }

// ── Bbox Incremental Loading ──────────────────────────────────────────────────
let _loadedBbox          = null;
let _currentPeriodFilter = {};
let _isFetchingBbox      = false;

export function getLoadedBbox()                       { return _loadedBbox; }
export function setLoadedBbox(bbox)                   { _loadedBbox = bbox; }
export function getCurrentPeriodFilter()              { return _currentPeriodFilter; }
export function setCurrentPeriodFilter(f)             { _currentPeriodFilter = f; }
export function getIsFetchingBbox()                   { return _isFetchingBbox; }
export function setIsFetchingBbox(val)                { _isFetchingBbox = val; }

// ── Control Button Callbacks ──────────────────────────────────────────────────
// Diset oleh pelanggan.js saat init, dibaca oleh pelanggan-loader.js
// Ini memutus circular dependency loader ↔ pelanggan.js
let _controlCallbacks = {
    onToggle:         () => {},
    onDragMode:       () => {},
    onSave:           () => {},
    onFixKoordinat:   () => {},
    onShowBuilding:   () => {},
    onImportLatLong:  () => {},
};

export function setControlCallbacks(cbs) { _controlCallbacks = { ..._controlCallbacks, ...cbs }; }
export function getControlCallbacks()    { return _controlCallbacks; }

// ── Viewport Out Of Bounds ref ────────────────────────────────────────────────
// Disimpan agar clearPelangganLayer bisa off-kan tanpa import balik ke loader
let _onViewportOutOfBounds = null;
export function setOnViewportOutOfBoundsRef(fn) { _onViewportOutOfBounds = fn; }
export function getOnViewportOutOfBoundsRef()   { return _onViewportOutOfBounds; }