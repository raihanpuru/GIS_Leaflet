let _pelangganData      = [];
let _pelangganCount     = 0;
let _isPelangganVisible = false;

// Marker → row data lookup — diisi dari pelanggan.js, dipakai di filter modules
let _markerToRow = new Map();

// ── Getters ──────────────────────────────────────────────────────────────────

export function getPelangganData()        { return _pelangganData; }
export function getPelangganCount()       { return _pelangganCount; }
export function isPelangganLayerVisible() { return _isPelangganVisible; }
export function getMarkerRow(marker)      { return _markerToRow.get(marker); }
export function getMarkerRowMap()         { return _markerToRow; }

// ── Setters (hanya boleh dipanggil dari pelanggan.js) ────────────────────────

export function _setPelangganData(data)       { _pelangganData      = data; }
export function _setPelangganCount(count)     { _pelangganCount     = count; }
export function _setIsPelangganVisible(val)   { _isPelangganVisible = val; }
export function _setMarkerRow(marker, row)    { _markerToRow.set(marker, row); }
export function _clearMarkerRowMap()          { _markerToRow = new Map(); }
// ── Koordinat Helpers ─────────────────────────────────────────────────────────

function isKoordinatInvalid(lat, lng) {
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return true;
    if (lat === 0 && lng === 0) return true;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return true;
    if (lat < -9 || lat > -6 || lng < 110 || lng > 115) return true; // Range Jawa Timur ± buffer
    return false;
}

export function getInvalidPelanggan() {
    const seen = new Set();
    return _pelangganData.filter(p => {
        const lat = parseFloat(p.Lat);
        const lng = parseFloat(p.Long);
        if (!isKoordinatInvalid(lat, lng)) return false;
        if (seen.has(p.nosambungan)) return false;
        seen.add(p.nosambungan);
        return true;
    });
}