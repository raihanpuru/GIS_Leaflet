import { 
    getAvailableBloks, 
    highlightBuildingsByBlok, 
    clearBuildingHighlight,
    highlightNonPelangganBuildings,
    refreshFilter as refreshFilterCore
} from '../pelanggan/pelanggan-filter.js';

export { refreshFilterCore as refreshFilter };

export function createBlokFilterControl(getGeojsonData) {
    const control = L.control({ position: 'topleft' });
    
    control.onAdd = function() {
        const container = L.DomUtil.create('div', 'blok-filter-control');
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
        title.textContent = 'Filter Blok Pelanggan';

        const selectContainer = L.DomUtil.create('div', '', container);
        selectContainer.style.cssText = 'margin-bottom: 8px;';

        const select = L.DomUtil.create('select', '', selectContainer);
        select.id = 'blokFilterSelect';
        select.style.cssText = `
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

        select.onmouseover = () => {
            select.style.borderColor = '#1976D2';
            select.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.3)';
        };
        select.onmouseout = () => {
            select.style.borderColor = '#2196F3';
            select.style.boxShadow = 'none';
        };

        updateBlokOptions(select);

        select.onchange = function() {
            const selectedBlok = this.value;
            const geojsonData = getGeojsonData();
            
            const checkbox = document.getElementById('nonPelangganCheckbox');
            if (checkbox) checkbox.checked = false;
            
            if (selectedBlok && geojsonData) {
                highlightBuildingsByBlok(selectedBlok, geojsonData);
            } else {
                clearBuildingHighlight();
            }
        };

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

        // Add filter description display
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

        checkbox.onchange = function() {
            const geojsonData = getGeojsonData();
            
            if (this.checked) {
                select.value = '';
                
                if (geojsonData) {
                    highlightNonPelangganBuildings(geojsonData);
                }
            } else {
                clearBuildingHighlight();
            }
        };

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
            margin-top: 8px;
        `;

        btnClear.onmouseover = () => {
            btnClear.style.transform = 'scale(1.05)';
            btnClear.style.boxShadow = '0 2px 8px rgba(244, 67, 54, 0.3)';
        };
        btnClear.onmouseout = () => {
            btnClear.style.transform = 'scale(1)';
            btnClear.style.boxShadow = 'none';
        };

        btnClear.onclick = () => {
            select.value = '';
            checkbox.checked = false;
            clearBuildingHighlight();
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
    
    // Reset selection jika blok yang dipilih tidak ada dalam list baru
    if (currentValue && !bloks.includes(currentValue)) {
        selectElement.value = '';
    } else if (currentValue && bloks.includes(currentValue)) {
        selectElement.value = currentValue;
    }
    
    const addressInfo = filterByAddress ? ` (alamat: ${filterByAddress})` : '';
    console.log(`[pelanggan-filter-ui] Loaded ${bloks.length} blok options${addressInfo}:`, bloks.join(', '));
}

export function updateFilterDescription(categoryFilters) {
    const descContainer = document.getElementById('blokFilterDesc');
    if (!descContainer) return;
    
    // Build filter description text
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