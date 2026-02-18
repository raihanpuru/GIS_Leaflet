import { initKecamatanDropdown } from '../polygon/kecamatan.js';
import { loadGeoJSON, getMap, getCurrentGeojsonData, toggleBuildingLayer, isBuildingVisible } from '../polygon/polygon.js';
import { loadPelanggan, setCurrentKecamatan } from '../pelanggan/pelanggan.js';
import { handleMapClick, setActiveKecamatan } from '../polygon/building-creator.js';
import { createBuildingCreatorControl } from '../components/building-creator-ui.js';
import { createBlokFilterControl } from '../components/pelanggan-filter-ui.js';
import { createAddressFilterControl } from '../components/pelanggan-address-filter-ui.js';
import { createPeriodFilterControl } from '../components/pelanggan-period-filter-ui.js';

const AppConfig = {
    defaultKecamatan: 'sidoarjo', 
    autoLoadPelanggan: true
};

let currentKecamatan = AppConfig.defaultKecamatan;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Aplikasi Peta Sidoarjo dimulai...');
    
    const kecamatanSelect = document.getElementById('kecamatanSelect');
    if (kecamatanSelect) {
        initKecamatanDropdown(kecamatanSelect, handleKecamatanChange);
        console.log('Dropdown kecamatan initialized');
    } else {
        console.error('Element #kecamatanSelect tidak ditemukan');
    }
    
    if (AppConfig.autoLoadPelanggan) {
        setTimeout(() => {
            loadPelanggan();
            console.log('Pelanggan layer loaded');
        }, 500);
    }
    
    if (AppConfig.defaultKecamatan) {
        loadGeoJSON(AppConfig.defaultKecamatan);
        setCurrentKecamatan(AppConfig.defaultKecamatan);
        setActiveKecamatan(AppConfig.defaultKecamatan);
        if (kecamatanSelect) {
            kecamatanSelect.value = AppConfig.defaultKecamatan;
        }
    }
    
    setTimeout(() => {
        const map = getMap();
        if (map) {
            const buildingControl = createBuildingCreatorControl(() => currentKecamatan);
            buildingControl.addTo(map);
            
            // Period filter sekarang bukan Leaflet control, langsung panggil fungsinya
            createPeriodFilterControl();
            
            const blokFilterControl = createBlokFilterControl(getCurrentGeojsonData);
            blokFilterControl.addTo(map);
            
            const addressFilterControl = createAddressFilterControl(getCurrentGeojsonData);
            addressFilterControl.addTo(map);
            
            map.on('click', handleMapClick);
            
            console.log('Building creator control initialized');
            console.log('Period filter control initialized');
            console.log('Blok filter control initialized');
            console.log('Address filter control initialized');
        }
    }, 600);
    
    console.log('Aplikasi siap digunakan!');
});

function handleKecamatanChange(kecamatan) {
    console.log(`Memuat data kecamatan: ${kecamatan}`);
    currentKecamatan = kecamatan;
    loadGeoJSON(kecamatan);
    setCurrentKecamatan(kecamatan);
    setActiveKecamatan(kecamatan);
}

export { AppConfig, currentKecamatan };