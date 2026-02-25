import { categories, getCategory } from '../polygon/kategori.js';
import { PELANGGAN_BUILDING_COLOR } from '../pelanggan/building-pelanggan-matcher.js';

export function getStyle(category, isBuilding = false, hasPelanggan = false) {
    const cat = categories[category];
    
    if (isBuilding && hasPelanggan) {
        return {
            fillColor: PELANGGAN_BUILDING_COLOR,
            weight: 2,
            opacity: 1,
            color: '#1976D2', 
            fillOpacity: 0.75
        };
    }
    
    return {
        fillColor: cat.color,
        weight: 1,
        opacity: 0.8,
        color: cat.color,
        fillOpacity: isBuilding ? 0.60 : 0.4
    };
}

export function createPopupContent(feature, category, latlng, pelangganList = []) {
    let popupContent = '<div style="font-size: 12px;">';
    popupContent += `<strong>Kategori:</strong> ${categories[category].name}<br>`;
    
    if (feature.properties.name) {
        popupContent += `<strong>Nama:</strong> ${feature.properties.name}<br>`;
    }
    if (feature.properties.amenity) {
        popupContent += `<strong>Amenity:</strong> ${feature.properties.amenity}<br>`;
    }
    if (feature.properties.building) {
        popupContent += `<strong>Building:</strong> ${feature.properties.building}<br>`;
    }
    if (feature.properties.leisure) {
        popupContent += `<strong>Leisure:</strong> ${feature.properties.leisure}<br>`;
    }
    
    if (pelangganList && pelangganList.length > 0) {
        popupContent += `<hr style="margin: 8px 0; border: none; border-top: 2px solid #2196F3;">`;
        popupContent += `<div style="background: #E3F2FD; padding: 8px; border-radius: 4px; margin-top: 8px;">`;
        popupContent += `<strong style="color: #1976D2;">Pelanggan di Bangunan Ini (${pelangganList.length}):</strong><br>`;
        
        pelangganList.forEach((pel, idx) => {
            const nama = pel['nama'] || '-';
            const idpel = pel['idpelanggan'] || '-';
            const nopel = pel['nopelanggan'] || '-';
            const alamat = pel['alamat'] || '-';
            const noalamat = pel['noalamat'] || '-';
            const alamatLengkap = `${alamat} ${noalamat}`.trim();
            
            popupContent += `<div style="margin-top: 6px; padding: 6px; background: white; border-radius: 3px; border-left: 3px solid #2196F3;">`;
            popupContent += `<strong>${idx + 1}. ${nama}</strong><br>`;
            popupContent += `<span style="font-size: 11px; color: #666;">ID: ${idpel} | No: ${nopel}</span><br>`;
            popupContent += `<span style="font-size: 11px; color: #ff9800;">${alamatLengkap}</span>`;
            popupContent += `</div>`;
        });
        
        popupContent += `</div>`;
    }
    
    if (latlng) {
        popupContent += `<hr style="margin: 8px 0;">`;
        popupContent += `<strong>Koordinat:</strong><br>`;
        popupContent += `Lat: ${latlng.lat.toFixed(6)}<br>`;
        popupContent += `Long: ${latlng.lng.toFixed(6)}`;
    }
    
    popupContent += '</div>';
    return popupContent;
}

export function pointToLayer(feature, latlng) {
    const category = getCategory(feature.properties);
    const cat = categories[category];
    
    const size = 0.0001; 
    
    const bounds = [
        [latlng.lat - size, latlng.lng - size],
        [latlng.lat + size, latlng.lng + size]
    ];
    
    return L.rectangle(bounds, {
        fillColor: cat.color,
        weight: 1,
        opacity: 0.8,
        color: cat.color,
        fillOpacity: 0.4
    });
}

export function createLegendControl() {
    const legend = L.control({position: 'bottomright'});
    
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = '<h4>Kategori Area</h4>';
        
        div.innerHTML += `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${PELANGGAN_BUILDING_COLOR}"></div>
                <span>Bangunan dengan Pelanggan</span>
            </div>
        `;
        
        Object.keys(categories).forEach(cat => {
            const category = categories[cat];
            div.innerHTML += `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${category.color}"></div>
                    <span>${category.name} (${category.count})</span>
                </div>
            `;
        });
        
        return div;
    };
    
    return legend;
}

export function createLayerControl(currentLayers) {
    const overlays = {};
    Object.keys(categories).forEach(cat => {
        overlays[categories[cat].name] = currentLayers[cat];
    });
    
    return L.control.layers(null, overlays, {position: 'bottomleft'});
}


export function updateBuildingCountDisplay(kecamatanName, buildingCount) {
    let infoDisplay = document.getElementById('kecamatan-info');
    
    if (!infoDisplay) {
        const dropdown = document.getElementById('kecamatanSelect');
        if (dropdown && dropdown.parentElement) {
            infoDisplay = document.createElement('div');
            infoDisplay.id = 'kecamatan-info';
            infoDisplay.style.cssText = `
                margin-left: 12px;
                padding: 8px 16px;
                background: #fff;
                border: 2px solid #4CAF50;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                color: #333;
                box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                white-space: nowrap;
            `;
            dropdown.parentElement.appendChild(infoDisplay);
        }
    }
    
     if (infoDisplay) {
        infoDisplay.style.display = 'none';
    }
}

export function updatePelangganBuildingCount(count) {
    const countElement = document.getElementById('building-pelanggan-count');
    if (countElement) {
        countElement.textContent = `(${count})`;
    }
}

export function updateShowBuildingButton(isVisible, buildingCount = null) {
    const btn = document.getElementById('show-building-btn');
    if (!btn) return;
    
    if (isVisible) {
        btn.innerHTML = 'Hide Building';
        btn.style.borderColor = '#c62828';
        btn.style.color = '#c62828';
    } else {
        btn.innerHTML = 'Show Building';
        btn.style.borderColor = '#4CAF50';
        btn.style.color = '#4CAF50';
    }
}