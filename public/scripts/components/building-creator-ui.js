import { 
    toggleAddBuildingMode, 
    downloadUpdatedGeoJSON, 
    getNewBuildingsCount,
    isInAddingMode 
} from '../polygon/building-creator.js';

export function createBuildingCreatorControl(currentKecamatan) {
    const control = L.control({ position: 'topright' });
    
    control.onAdd = function() {
        const container = L.DomUtil.create('div', 'building-creator-control');
        container.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            margin-bottom: 8px;
        `;

        const title = L.DomUtil.create('div', '', container);
        title.style.cssText = `
            font-size: 13px;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f0f0f0;
        `;
        title.textContent = 'Building Creator';

        const btnContainer = L.DomUtil.create('div', '', container);
        btnContainer.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

        const btnAdd = L.DomUtil.create('button', '', btnContainer);
        btnAdd.id = 'btnAddBuilding';
        btnAdd.innerHTML = 'Add Building';
        btnAdd.style.cssText = `
            background: #fff;
            border: 2px solid #4CAF50;
            color: #4CAF50;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        `;

        btnAdd.onmouseover = () => {
            btnAdd.style.transform = 'scale(1.05)';
            btnAdd.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
        };
        btnAdd.onmouseout = () => {
            btnAdd.style.transform = 'scale(1)';
            btnAdd.style.boxShadow = 'none';
        };

        btnAdd.onclick = () => {
            const isActive = toggleAddBuildingMode();
            updateAddButton(isActive);
        };

        const btnDownload = L.DomUtil.create('button', '', btnContainer);
        btnDownload.id = 'btnDownloadGeoJSON';
        btnDownload.innerHTML = 'Download GeoJSON';
        btnDownload.style.cssText = `
            background: #fff;
            border: 2px solid #2196F3;
            color: #2196F3;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        `;

        btnDownload.onmouseover = () => {
            btnDownload.style.transform = 'scale(1.05)';
            btnDownload.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.3)';
        };
        btnDownload.onmouseout = () => {
            btnDownload.style.transform = 'scale(1)';
            btnDownload.style.boxShadow = 'none';
        };

        btnDownload.onclick = () => {
            if (typeof currentKecamatan === 'function') {
                downloadUpdatedGeoJSON(currentKecamatan());
            } else {
                downloadUpdatedGeoJSON(currentKecamatan);
            }
        };

        const counter = L.DomUtil.create('div', '', container);
        counter.id = 'newBuildingCounter';
        counter.style.cssText = `
            font-size: 12px;
            color: #666;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #f0f0f0;
            text-align: center;
        `;
        updateCounter();

        L.DomEvent.disableClickPropagation(container);
        return container;
    };

    return control;
}

export function updateAddButton(isActive) {
    const btn = document.getElementById('btnAddBuilding');
    if (btn) {
        if (isActive) {
            btn.innerHTML = 'Cancel Adding';
            btn.style.borderColor = '#f44336';
            btn.style.color = '#f44336';
        } else {
            btn.innerHTML = 'Add Building';
            btn.style.borderColor = '#4CAF50';
            btn.style.color = '#4CAF50';
        }
    }
}

export function updateCounter() {
    const counter = document.getElementById('newBuildingCounter');
    if (counter) {
        const count = getNewBuildingsCount();
        if (count > 0) {
            counter.innerHTML = `
                <span style="color: #ff9800; font-weight: 600;">
                    ${count} bangunan baru
                </span>
            `;
        } else {
            counter.textContent = 'Belum ada bangunan baru';
        }
    }
}

if (typeof window !== 'undefined') {
    window.updateBuildingCounter = updateCounter;
}