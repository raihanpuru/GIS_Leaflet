
let _pelangganData      = [];
let _pelangganCount     = 0;
let _isPelangganVisible = false;

// ── Getters ──────────────────────────────────────────────────────────────────

export function getPelangganData()        { return _pelangganData; }
export function getPelangganCount()       { return _pelangganCount; }
export function isPelangganLayerVisible() { return _isPelangganVisible; }

// ── Setters (hanya boleh dipanggil dari pelanggan.js) ────────────────────────

export function _setPelangganData(data)       { _pelangganData      = data; }
export function _setPelangganCount(count)     { _pelangganCount     = count; }
export function _setIsPelangganVisible(val)   { _isPelangganVisible = val; }