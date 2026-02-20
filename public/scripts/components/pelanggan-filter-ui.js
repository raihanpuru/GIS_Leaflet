import { 
    getAvailableBloks, 
    highlightBuildingsByBlok, 
    clearBuildingHighlight,
    highlightNonPelangganBuildings,
    refreshFilter as refreshFilterCore
} from '../pelanggan/pelanggan-filter.js';

import { 
    getAvailableAddresses, 
    highlightBuildingsByAddress, 
    clearBuildingHighlight as clearHighlight
} from '../pelanggan/pelanggan-address-filter.js';

export { refreshFilterCore as refreshFilter };

export function createBlokFilterControl(getGeojsonData) {
    const control = L.control({ position: 'topleft' });
    
    control.onAdd = function() {
        const container = L.DomUtil.create('div', 'combined-filter-control');
        container.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            margin-top: 10px;
            min-width: 200px;
            max-width: 250px;
        `;

        // ── SECTION HEADER
        const mainTitle = L.DomUtil.create('div', '', container);
        mainTitle.style.cssText = `
            font-size: 13px;
            font-weight: 700;
            color: #333;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f0f0f0;
        `;
        mainTitle.textContent = 'Filter Pelanggan';

        // ── LABEL ALAMAT
        const addressLabel = L.DomUtil.create('div', '', container);
        addressLabel.style.cssText = `
            font-size: 11px;
            font-weight: 600;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        `;
        addressLabel.textContent = 'Alamat';

        const addressSelectContainer = L.DomUtil.create('div', '', container);
        addressSelectContainer.style.cssText = 'margin-bottom: 10px;';

        const addressSelect = L.DomUtil.create('select', '', addressSelectContainer);
        addressSelect.id = 'addressFilterSelect';
        addressSelect.style.cssText = `
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

        addressSelect.onmouseover = () => {
            addressSelect.style.borderColor = '#F57C00';
            addressSelect.style.boxShadow = '0 2px 8px rgba(255, 152, 0, 0.3)';
        };
        addressSelect.onmouseout = () => {
            addressSelect.style.borderColor = '#FF9800';
            addressSelect.style.boxShadow = 'none';
        };

        updateAddressOptions(addressSelect);

        // ── DIVIDER
        const divider = L.DomUtil.create('div', '', container);
        divider.style.cssText = `
            border-top: 1px solid #f0f0f0;
            margin-bottom: 10px;
        `;

        // ── LABEL BLOK
        const blokLabel = L.DomUtil.create('div', '', container);
        blokLabel.style.cssText = `
            font-size: 11px;
            font-weight: 600;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        `;
        blokLabel.textContent = 'Blok';

        const blokSelectContainer = L.DomUtil.create('div', '', container);
        blokSelectContainer.style.cssText = 'margin-bottom: 8px;';

        const blokSelect = L.DomUtil.create('select', '', blokSelectContainer);
        blokSelect.id = 'blokFilterSelect';
        blokSelect.style.cssText = `
            width: 100%;
            padding: 8px;
            border: 2px solid #2196F3;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #333;
            cursor: pointer;
            background: white;
            transition: all 0.2s ease;
        `;

        blokSelect.onmouseover = () => {
            blokSelect.style.borderColor = '#1976D2';
            blokSelect.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.3)';
        };
        blokSelect.onmouseout = () => {
            blokSelect.style.borderColor = '#2196F3';
            blokSelect.style.boxShadow = 'none';
        };

        updateBlokOptions(blokSelect);

        // ── CHECKBOX
        const checkboxContainer = L.DomUtil.create('div', '', container);
        checkboxContainer.style.cssText = `
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #f0f0f0;
        `;

        const checkboxLabel = L.DomUtil.create('label', '', checkboxContainer);
        checkboxLabel.style.cssText = `
            display: flex;
            align-items: center;
            cursor: pointer;
            font-size: 12px;
            color: #666;
        `;

        const checkbox = L.DomUtil.create('input', '', checkboxLabel);
        checkbox.type = 'checkbox';
        checkbox.id = 'nonPelangganCheckbox';
        checkbox.style.cssText = `
            margin-right: 8px;
            cursor: pointer;
            width: 16px;
            height: 16px;
        `;

        const checkboxText = L.DomUtil.create('span', '', checkboxLabel);
        checkboxText.textContent = 'Tampilkan bangunan tanpa pelanggan';
        checkboxText.style.cssText = 'font-weight: 500;';

        // ── FILTER DESC
        const filterDescContainer = L.DomUtil.create('div', '', container);
        filterDescContainer.id = 'blokFilterDesc';
        filterDescContainer.style.cssText = `
            margin-top: 8px;
            padding: 8px;
            border-top: 1px solid #f0f0f0;
            font-size: 10px;
            color: #666;
            display: none;
            background: #f9fbe7;
            border-radius: 4px;
            border-left: 3px solid #4CAF50;
        `;

        // ── CLEAR ALL BUTTON
        const btnClear = L.DomUtil.create('button', '', container);
        btnClear.innerHTML = 'Clear Filter';
        btnClear.style.cssText = `
            width: 100%;
            background: #fff;
            border: 2px solid #f44336;
            color: #f44336;
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 10px;
        `;

        btnClear.onmouseover = () => {
            btnClear.style.transform = 'scale(1.05)';
            btnClear.style.boxShadow = '0 2px 8px rgba(244, 67, 54, 0.3)';
        };
        btnClear.onmouseout = () => {
            btnClear.style.transform = 'scale(1)';
            btnClear.style.boxShadow = 'none';
        };

        // ── EVENT HANDLERS
        addressSelect.onchange = function() {
            const selectedAddress = this.value;
            const geojsonData = getGeojsonData();
            
            updateBlokOptions(blokSelect, selectedAddress || null);
            
            if (selectedAddress && geojsonData) {
                highlightBuildingsByAddress(selectedAddress, geojsonData);
            } else {
                clearHighlight();
            }
        };

        blokSelect.onchange = function() {
            const selectedBlok = this.value;
            const geojsonData = getGeojsonData();
            
            if (checkbox) checkbox.checked = false;
            
            if (selectedBlok && geojsonData) {
                highlightBuildingsByBlok(selectedBlok, geojsonData);
            } else {
                clearBuildingHighlight();
            }
        };

        checkbox.onchange = function() {
            const geojsonData = getGeojsonData();
            
            if (this.checked) {
                blokSelect.value = '';
                if (geojsonData) {
                    highlightNonPelangganBuildings(geojsonData);
                }
            } else {
                clearBuildingHighlight();
            }
        };

        btnClear.onclick = () => {
            addressSelect.value = '';
            blokSelect.value = '';
            checkbox.checked = false;
            clearBuildingHighlight();
            clearHighlight();
            updateBlokOptions(blokSelect, null);
        };

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        return container;
    };

    return control;
}

export function updateBlokOptions(selectElement, filterByAddress = null) {
    if (!selectElement) {
        selectElement = document.getElementById('blokFilterSelect');
    }
    if (!selectElement) return;
    
    const bloks = getAvailableBloks(filterByAddress);
    const currentValue = selectElement.value; 
    
    selectElement.innerHTML = '<option value="">-- Pilih Blok --</option>';
    
    bloks.forEach(blok => {
        const option = document.createElement('option');
        option.value = blok;
        option.textContent = `Blok ${blok}`;
        selectElement.appendChild(option);
    });
    
    if (currentValue && !bloks.includes(currentValue)) {
        selectElement.value = '';
    } else if (currentValue && bloks.includes(currentValue)) {
        selectElement.value = currentValue;
    }
    
    const addressInfo = filterByAddress ? ` (alamat: ${filterByAddress})` : '';
    console.log(`[pelanggan-filter-ui] Loaded ${bloks.length} blok options${addressInfo}:`, bloks.join(', '));
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
    
    console.log(`[pelanggan-filter-ui] Loaded ${addresses.length} address options:`, addresses.join(', '));
}

export function updateFilterDescription(categoryFilters) {
    const descContainer = document.getElementById('blokFilterDesc');
    if (!descContainer) return;
    
    const parts = [];
    
    if (categoryFilters.usage !== 'all') {
        const usageText = categoryFilters.usage === 'low' ? '< 20 m³' : '≥ 20 m³';
        parts.push(`Pakai: ${usageText}`);
    }
    
    if (categoryFilters.status !== 'all') {
        const statusText = categoryFilters.status === 'lunas' ? 'Lunas' : 'Belum Lunas';
        parts.push(`Status: ${statusText}`);
    }
    
    if (parts.length > 0) {
        descContainer.innerHTML = `
            <div style="font-weight: 600; color: #558B2F; font-size: 10px; margin-bottom: 3px;">
                Filter Kategori Aktif
            </div>
            <div style="font-size: 9px; color: #666; line-height: 1.4;">
                ${parts.join(' • ')}
            </div>
        `;
        descContainer.style.display = 'block';
    } else {
        descContainer.style.display = 'none';
    }
}