import { 
    getAvailableAddresses, 
    highlightBuildingsByAddress, 
    clearBuildingHighlight as clearHighlight
} from '../pelanggan/pelanggan-address-filter.js';
import { updateBlokOptions } from './pelanggan-filter-ui.js';

export function createAddressFilterControl(getGeojsonData) {
    const control = L.control({ position: 'topleft' });
    
    control.onAdd = function() {
        const container = L.DomUtil.create('div', 'address-filter-control');
        container.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            margin-top: 10px;
            min-width: 200px;
            max-width: 250px;
        `;

        const title = L.DomUtil.create('div', '', container);
        title.style.cssText = `
            font-size: 13px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f0f0f0;
        `;
        title.textContent = 'Filter Alamat';

        const selectContainer = L.DomUtil.create('div', '', container);
        selectContainer.style.cssText = 'margin-bottom: 8px;';

        const select = L.DomUtil.create('select', '', selectContainer);
        select.id = 'addressFilterSelect';
        select.style.cssText = `
            width: 100%;
            padding: 8px;
            border: 2px solid #FF9800;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #333;
            cursor: pointer;
            background: white;
            transition: all 0.2s ease;
        `;

        select.onmouseover = () => {
            select.style.borderColor = '#F57C00';
            select.style.boxShadow = '0 2px 8px rgba(255, 152, 0, 0.3)';
        };
        select.onmouseout = () => {
            select.style.borderColor = '#FF9800';
            select.style.boxShadow = 'none';
        };

        updateAddressOptions(select);

        select.onchange = function() {
            const selectedAddress = this.value;
            const geojsonData = getGeojsonData();
            const blokSelect = document.getElementById('blokFilterSelect');
            
            // Update blok options berdasarkan alamat yang dipilih
            if (selectedAddress) {
                updateBlokOptions(blokSelect, selectedAddress);
            } else {
                // Jika address di-clear, tampilkan semua blok
                updateBlokOptions(blokSelect, null);
            }
            
            if (selectedAddress && geojsonData) {
                highlightBuildingsByAddress(selectedAddress, geojsonData);
            } else {
                clearHighlight();
            }
        };

        const btnClear = L.DomUtil.create('button', '', container);
        btnClear.innerHTML = 'Clear Filter';
        btnClear.style.cssText = `
            width: 100%;
            background: #fff;
            border: 2px solid #FF5722;
            color: #FF5722;
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 8px;
        `;

        btnClear.onmouseover = () => {
            btnClear.style.transform = 'scale(1.05)';
            btnClear.style.boxShadow = '0 2px 8px rgba(255, 87, 34, 0.3)';
        };
        btnClear.onmouseout = () => {
            btnClear.style.transform = 'scale(1)';
            btnClear.style.boxShadow = 'none';
        };

        btnClear.onclick = () => {
            select.value = '';
            clearHighlight();
            
            // Reset blok options untuk menampilkan semua blok
            const blokSelect = document.getElementById('blokFilterSelect');
            updateBlokOptions(blokSelect, null);
        };

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        return container;
    };

    return control;
}

export function updateAddressOptions(selectElement) {
    if (!selectElement) {
        selectElement = document.getElementById('addressFilterSelect');
    }
    
    if (!selectElement) return;
    
    const addresses = getAvailableAddresses();
    const currentValue = selectElement.value; 
    
    selectElement.innerHTML = '<option value="">-- Pilih Alamat --</option>';
    
    addresses.forEach(address => {
        const option = document.createElement('option');
        option.value = address;
        option.textContent = address;
        selectElement.appendChild(option);
    });
    
    if (currentValue && addresses.includes(currentValue)) {
        selectElement.value = currentValue;
    }
    
    console.log(`[address-filter-ui] Loaded ${addresses.length} address options:`, addresses.join(', '));
}