export const PIN_ICON = L.divIcon({
    className: '',
    html: `
        <div style="position:relative; width:24px; height:32px;">
            <div style="position:absolute; bottom:0; left:50%; transform:translateX(-50%);
                        width:10px; height:4px; border-radius:50%;
                        background:rgba(0,0,0,0.25); filter:blur(1px);"></div>
            <svg width="24" height="30" viewBox="0 0 24 30" style="position:absolute; top:0; left:0;">
                <defs>
                    <linearGradient id="pinGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#ef5350"/>
                        <stop offset="100%" stop-color="#c62828"/>
                    </linearGradient>
                </defs>
                <path d="M12 0 C5.37 0 0 5.37 0 12 C0 18.63 12 30 12 30 C12 30 24 18.63 24 12 C24 5.37 18.63 0 12 0 Z"
                      fill="url(#pinGrad)" stroke="#b71c1c" stroke-width="1.2"/>
                <circle cx="12" cy="12" r="4.5" fill="#fff" opacity="0.9"/>
            </svg>
        </div>`,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -34]
});

export const SAVING_ICON = L.divIcon({
    className: '',
    html: `
        <div style="position:relative; width:24px; height:32px;">
            <div style="position:absolute; bottom:0; left:50%; transform:translateX(-50%);
                        width:10px; height:4px; border-radius:50%;
                        background:rgba(0,0,0,0.25); filter:blur(1px);"></div>
            <svg width="24" height="30" viewBox="0 0 24 30" style="position:absolute; top:0; left:0;">
                <path d="M12 0 C5.37 0 0 5.37 0 12 C0 18.63 12 30 12 30 C12 30 24 18.63 24 12 C24 5.37 18.63 0 12 0 Z"
                      fill="#FFA726" stroke="#E65100" stroke-width="1.2"/>
                <circle cx="12" cy="12" r="4.5" fill="#fff" opacity="0.9"/>
                <text x="12" y="16" text-anchor="middle" font-size="9" fill="#E65100" font-weight="bold">...</text>
            </svg>
        </div>`,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -34]
});

export const ERROR_ICON = L.divIcon({
    className: '',
    html: `
        <div style="position:relative; width:24px; height:32px;">
            <div style="position:absolute; bottom:0; left:50%; transform:translateX(-50%);
                        width:10px; height:4px; border-radius:50%;
                        background:rgba(0,0,0,0.25); filter:blur(1px);"></div>
            <svg width="24" height="30" viewBox="0 0 24 30" style="position:absolute; top:0; left:0;">
                <path d="M12 0 C5.37 0 0 5.37 0 12 C0 18.63 12 30 12 30 C12 30 24 18.63 24 12 C24 5.37 18.63 0 12 0 Z"
                      fill="#EF5350" stroke="#B71C1C" stroke-width="1.2"/>
                <text x="12" y="17" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">!</text>
            </svg>
        </div>`,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -34]
});

export function buildPopup(row) {
    const nama  = row['nama']        || '-';
    const id    = row['idpelanggan'] || '-';
    const no    = row['nopelanggan'] || '-';
    const almt  = row['noalamat']    || '-';
    const lat   = row['Lat'] || row['latitude'];
    const lng   = row['Long'] || row['longitude'];
    
    // New fields
    const pakai = row['pakai'] !== undefined && row['pakai'] !== null ? row['pakai'] : '-';
    const tagihan = row['tagihan'] !== undefined && row['tagihan'] !== null 
        ? `Rp ${parseFloat(row['tagihan']).toLocaleString('id-ID')}` 
        : '-';
    const tglbayar = row['tglbayar'] ? new Date(row['tglbayar']).toLocaleDateString('id-ID') : '-';
    const lunas = row['lunas'] !== undefined && row['lunas'] !== null 
        ? (row['lunas'] == 1 ? 'Lunas' : 'Belum Lunas') 
        : '-';
    const statusColor = row['lunas'] == 1 ? '#2e7d32' : '#c62828';

    return `
        <div style="font-size:12px; min-width:200px;">
            <div style="font-weight:bold; color:#c62828; margin-bottom:6px; font-size:13px;">
                Pelanggan
            </div>
            <table style="width:100%; border-collapse:collapse;">
                <tr><td style="padding:2px 0; color:#757575; width:100px;">Nama</td>
                    <td style="padding:2px 0; font-weight:500;">${nama}</td></tr>
                <tr><td style="padding:2px 0; color:#757575;">ID</td>
                    <td style="padding:2px 0;">${id}</td></tr>
                <tr><td style="padding:2px 0; color:#757575;">No Pelanggan</td>
                    <td style="padding:2px 0;">${no}</td></tr>
                <tr><td style="padding:2px 0; color:#757575;">No Alamat</td>
                    <td style="padding:2px 0;">${almt}</td></tr>
                <tr><td colspan="2" style="padding:6px 0 3px 0; border-top:1px solid #e0e0e0; font-weight:600; color:#555;">
                    Informasi Tagihan
                </td></tr>
                <tr><td style="padding:2px 0; color:#757575;">Penggunaan</td>
                    <td style="padding:2px 0; font-weight:500;">${pakai} m³</td></tr>
                <tr><td style="padding:2px 0; color:#757575;">Tagihan</td>
                    <td style="padding:2px 0; font-weight:500;">${tagihan}</td></tr>
                <tr><td style="padding:2px 0; color:#757575;">Tgl Bayar</td>
                    <td style="padding:2px 0;">${tglbayar}</td></tr>
                <tr><td style="padding:2px 0; color:#757575;">Status</td>
                    <td style="padding:2px 0; font-weight:600; color:${statusColor};">${lunas}</td></tr>
                <tr><td colspan="2" style="padding:3px 0 0 0; border-top:1px solid #e0e0e0;"></td></tr>
                <tr><td style="padding:2px 0; color:#757575;">Koordinat</td>
                    <td style="padding:2px 0; font-size:10px;">${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}</td></tr>
            </table>
        </div>`;
}

export function buildLabel(nama) {
    if (!nama || nama === '-' || nama === '') {
        return L.divIcon({ html: '', iconSize: [0, 0] });
    }

    const displayName = nama.length > 18 ? nama.substring(0, 16) + '..' : nama;

    return L.divIcon({
        className: '',
        html: `<div style="
            position: absolute;
            left: -60px;
            top: 2px;
            white-space: nowrap;
            background: rgba(255,255,255,0.88);
            border: 1px solid #ccc;
            border-radius: 3px;
            padding: 1px 5px;
            font-size: 11px;
            font-weight: 500;
            color: #333;
            pointer-events: none;
            box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        ">${displayName}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });
}

export function createLegend(pelangganCount, isDraggingEnabled) {
    // Update the inline DOM legend next to the kecamatan dropdown
    updateLegend(pelangganCount, isDraggingEnabled);

    // Return a dummy no-op control so existing .addTo(map) callers still work
    const dummy = L.control({ position: 'topleft' });
    dummy.onAdd = function() { return L.DomUtil.create('div', ''); };
    return dummy;
}

export function updateLegend(pelangganCount, isDraggingEnabled) {
    const dropdown = document.getElementById('kecamatanSelect');
    if (!dropdown || !dropdown.parentElement) return;

    let legendEl = document.getElementById('pelanggan-puri-legend');

    if (!legendEl) {
        legendEl = document.createElement('div');
        legendEl.id = 'pelanggan-puri-legend';
        legendEl.style.cssText = `
            display: inline-flex;
            flex-direction: column;
            justify-content: center;
            margin-right: 12px;
            padding-right: 12px;
            border-right: 2px solid #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        legendEl.innerHTML = `
            <div id="pelanggan-legend-row" style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:13px; font-weight:600; color:#333; white-space:nowrap;">Total Pelanggan:</span>
                <span style="font-size:13px; font-weight:500; color:#555; white-space:nowrap;">
                    <strong id="pelanggan-legend-count" style="color:#2e7d32; font-size:16px;">0</strong>
                </span>
                <span id="pelanggan-legend-mode" style="font-size:11px; color:#666; white-space:nowrap;"></span>
            </div>
        `;
        // Insert BEFORE the select (left side)
        dropdown.parentElement.insertBefore(legendEl, dropdown);
    }

    const countEl = document.getElementById('pelanggan-legend-count');
    const modeEl  = document.getElementById('pelanggan-legend-mode');

    if (countEl) countEl.textContent = pelangganCount;
    if (modeEl) {
        modeEl.innerHTML = isDraggingEnabled
            ? '<span style="color:#f57c00; font-weight:600;">Edit Mode</span>'
            : '<span style="color:#666;">View Mode</span>';
    }
}

export function createControlButtons(callbacks) {
    const { onToggle, onDragMode, onSave, onAutoCorrect, onShowBuilding } = callbacks;
    
    const control = L.control({ position: 'topright' });
    
    control.onAdd = function() {
        const container = L.DomUtil.create('div', 'leaflet-control-container');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        const buttonStyle = (borderColor, color) => `
            background: #fff;
            border: 2px solid ${borderColor};
            color: ${color};
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
            font-family: inherit;
        `;

        const addHoverEffect = (btn) => {
            btn.onmouseover = () => {
                btn.style.transform = 'scale(1.05)';
                btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            };
            btn.onmouseout = () => {
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
            };
        };

        const btnToggle = L.DomUtil.create('button', 'leaflet-toggle-btn');
        btnToggle.id = 'togglePelanggan';
        btnToggle.innerHTML = 'Show Pelanggan';
        btnToggle.style.cssText = buttonStyle('#2e7d32', '#2e7d32');
        addHoverEffect(btnToggle);
        btnToggle.onclick = onToggle;
        L.DomEvent.disableClickPropagation(btnToggle);

        const btnDrag = L.DomUtil.create('button', 'leaflet-drag-btn');
        btnDrag.id = 'toggleDragMode';
        btnDrag.innerHTML = 'Enable Edit';
        btnDrag.style.cssText = buttonStyle('#666', '#666');
        addHoverEffect(btnDrag);
        btnDrag.onclick = onDragMode;
        L.DomEvent.disableClickPropagation(btnDrag);

        const btnAutoCorrect = L.DomUtil.create('button', 'leaflet-autocorrect-btn');
        btnAutoCorrect.id = 'autoCorrectBtn';
        btnAutoCorrect.innerHTML = 'Auto-Correct';
        btnAutoCorrect.style.cssText = buttonStyle('#ff9800', '#ff9800');
        addHoverEffect(btnAutoCorrect);
        btnAutoCorrect.onclick = onAutoCorrect;
        L.DomEvent.disableClickPropagation(btnAutoCorrect);

        const btnSave = L.DomUtil.create('button', 'leaflet-save-btn');
        btnSave.id = 'savePelanggan';
        btnSave.innerHTML = 'Save CSV';
        btnSave.style.cssText = buttonStyle('#1976d2', '#1976d2');
        addHoverEffect(btnSave);
        btnSave.onclick = onSave;
        L.DomEvent.disableClickPropagation(btnSave);

        const btnShowBuilding = L.DomUtil.create('button', 'leaflet-show-building-btn');
        btnShowBuilding.id = 'show-building-btn';
        btnShowBuilding.innerHTML = 'Show Building';
        btnShowBuilding.style.cssText = buttonStyle('#2e7d32', '#2e7d32');
        addHoverEffect(btnShowBuilding);
        btnShowBuilding.onclick = onShowBuilding;
        L.DomEvent.disableClickPropagation(btnShowBuilding);

        container.appendChild(btnToggle);
        container.appendChild(btnShowBuilding);
        container.appendChild(btnDrag);
        container.appendChild(btnAutoCorrect);
        container.appendChild(btnSave);

        return container;
    };

    return control;
}

export function updateToggleButton(isVisible) {
    const btn = document.getElementById('togglePelanggan');
    if (btn) {
        if (isVisible) {
            btn.innerHTML = 'Hide Pelanggan';
            btn.style.borderColor = '#c62828';
            btn.style.color = '#c62828';
        } else {
            btn.innerHTML = 'Show Pelanggan';
            btn.style.borderColor = '#2e7d32';
            btn.style.color = '#2e7d32';
        }
    }
}

export function updateDragButton(isDragging) {
    const btn = document.getElementById('toggleDragMode');
    if (btn) {
        if (isDragging) {
            btn.innerHTML = 'Disable Edit';
            btn.style.borderColor = '#f57c00';
            btn.style.color = '#f57c00';
        } else {
            btn.innerHTML = 'Enable Edit';
            btn.style.borderColor = '#666';
            btn.style.color = '#666';
        }
    }
}