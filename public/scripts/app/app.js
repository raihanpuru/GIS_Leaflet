import { initKecamatanDropdown } from '../polygon/kecamatan.js';
import { loadGeoJSON, getMap, getCurrentGeojsonData } from '../polygon/polygon.js';
import { loadPelanggan, setCurrentKecamatan, clearPelangganLayer } from '../pelanggan/pelanggan.js';
import { createBlokFilterControl } from '../components/pelanggan-filter-ui.js';
import { createPeriodFilterControl } from '../components/pelanggan-period-filter-ui.js';

const AppConfig = {
    defaultKecamatan: 'sidoarjo',
};

let currentKecamatan = AppConfig.defaultKecamatan;

document.addEventListener('DOMContentLoaded', function () {
    const kecamatanSelect = document.getElementById('kecamatanSelect');
    if (kecamatanSelect) {
        initKecamatanDropdown(kecamatanSelect, handleKecamatanChange);
    } else {
        console.error('Element #kecamatanSelect tidak ditemukan');
    }

    if (AppConfig.defaultKecamatan) {
        loadGeoJSON(AppConfig.defaultKecamatan);
        setCurrentKecamatan(AppConfig.defaultKecamatan);
        if (kecamatanSelect) kecamatanSelect.value = AppConfig.defaultKecamatan;
    }

    setTimeout(() => {
        const map = getMap();
        if (!map) return;

        // Pelanggan hanya dimuat setelah user pilih bulan + tahun
        createPeriodFilterControl({
            onLoad:  (period) => loadPelanggan(period),
            onClear: () => clearPelangganLayer(),
        });

        const blokFilterControl = createBlokFilterControl(getCurrentGeojsonData);
        blokFilterControl.addTo(map);
    }, 600);
});

function handleKecamatanChange(kecamatan) {
    currentKecamatan = kecamatan;
    loadGeoJSON(kecamatan);
    setCurrentKecamatan(kecamatan);
}

export { AppConfig, currentKecamatan };