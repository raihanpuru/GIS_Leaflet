import { 
    findNearestBuildings, 
    applyCorrections, 
    showCorrectionPreview,
    exportCorrectedData 
} from '../pelanggan/pelanggan-autocorrect.js';
import { getPelangganData } from '../pelanggan/pelanggan.js';

let currentPreviewLayer = null;
let currentCorrections = [];

export function createAutoCorrectButton(callbacks) {
    const control = L.control({ position: 'topright' });
    
    control.onAdd = function() {
        const btn = L.DomUtil.create('button', 'leaflet-autocorrect-btn');
        btn.id = 'btnAutoCorrect';
        btn.innerHTML = 'Auto-Correct';
        btn.style.cssText = `
            background: #fff;
            border: 2px solid #ff9800;
            color: #ff9800;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
            font-family: inherit;
        `;

        btn.onmouseover = () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        };
        btn.onmouseout = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
        };

        btn.onclick = () => {
            if (callbacks && callbacks.onClick) {
                callbacks.onClick();
            }
        };
        
        L.DomEvent.disableClickPropagation(btn);
        return btn;
    };

    return control;
}

export function showCorrectionDialog(corrections, kecamatan) {
    currentCorrections = corrections;

    const overlay = document.createElement('div');
    overlay.id = 'autocorrect-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    const header = `
        <div style="margin-bottom: 20px;">
            <h2 style="margin: 0 0 8px 0; color: #ff9800; font-size: 20px;">
                Auto-Correct Koordinat Pelanggan
            </h2>
            <p style="margin: 0; color: #666; font-size: 13px;">
                Kecamatan: <strong>${kecamatan.charAt(0).toUpperCase() + kecamatan.slice(1)}</strong>
            </p>
        </div>
    `;

    if (corrections.length === 0) {
        dialog.innerHTML = header + `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                <p style="font-size: 16px; color: #333; margin: 0;">
                    Tidak ada pelanggan yang perlu dikoreksi!
                </p>
                <p style="font-size: 13px; color: #666; margin: 8px 0 0 0;">
                    Semua koordinat pelanggan sudah akurat.
                </p>
            </div>
            <div style="text-align: right; margin-top: 20px;">
                <button id="btnCloseDialog" style="
                    background: #2196F3;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 10px 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">Tutup</button>
            </div>
        `;
    } else {
        let tableRows = '';
        corrections.forEach((corr, index) => {
            tableRows += `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 12px 8px; font-size: 12px;">${index + 1}</td>
                    <td style="padding: 12px 8px; font-size: 12px; font-weight: 500;">${corr.pelanggan['nama']}</td>
                    <td style="padding: 12px 8px; font-size: 11px; color: #666;">
                        ${corr.buildingName}<br>
                        <span style="color: #999;">(${corr.buildingType})</span>
                    </td>
                    <td style="padding: 12px 8px; font-size: 12px; color: #ff9800; font-weight: 600; text-align: center;">
                        ${corr.distance.toFixed(1)}m
                    </td>
                </tr>
            `;
        });

        dialog.innerHTML = header + `
            <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
                <div style="font-weight: 600; color: #e65100; margin-bottom: 4px;">
                    Ditemukan ${corrections.length} pelanggan yang akan dikoreksi
                </div>
                <div style="font-size: 12px; color: #666;">
                    Koordinat pelanggan akan dipindahkan ke centroid bangunan terdekat
                </div>
            </div>

            <div style="overflow-x: auto; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                            <th style="padding: 10px 8px; text-align: left; font-size: 12px;">#</th>
                            <th style="padding: 10px 8px; text-align: left; font-size: 12px;">Pelanggan</th>
                            <th style="padding: 10px 8px; text-align: left; font-size: 12px;">Bangunan Terdekat</th>
                            <th style="padding: 10px 8px; text-align: center; font-size: 12px;">Jarak</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="btnCancelDialog" style="
                    background: #f5f5f5;
                    color: #666;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    padding: 10px 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">Batal</button>
                <button id="btnPreview" style="
                    background: #2196F3;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 10px 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">Preview di Peta</button>
                <button id="btnApplyCorrection" style="
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 10px 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">Apply & Download CSV</button>
            </div>
        `;
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const btnClose = document.getElementById('btnCloseDialog');
    const btnCancel = document.getElementById('btnCancelDialog');
    const btnPreview = document.getElementById('btnPreview');
    const btnApply = document.getElementById('btnApplyCorrection');

    const closeDialog = () => {
        if (currentPreviewLayer) {
            const map = require('./polygon.js').getMap();
            if (map) {
                map.removeLayer(currentPreviewLayer);
                currentPreviewLayer = null;
            }
        }
        document.body.removeChild(overlay);
    };

    if (btnClose) btnClose.onclick = closeDialog;
    if (btnCancel) btnCancel.onclick = closeDialog;

    if (btnPreview) {
        btnPreview.onclick = () => {
            if (currentPreviewLayer) {
                const map = require('./polygon.js').getMap();
                if (map) map.removeLayer(currentPreviewLayer);
            }
            currentPreviewLayer = showCorrectionPreview(currentCorrections);
            btnPreview.textContent = 'Preview Diaktifkan ✓';
            btnPreview.style.background = '#1976D2';
        };
    }

    if (btnApply) {
        btnApply.onclick = () => {
            const confirmed = confirm(
                `Yakin ingin menerapkan ${corrections.length} koreksi?\n\n` +
                `File CSV baru akan didownload secara otomatis.`
            );

            if (confirmed) {
                applyCorrections(currentCorrections);
                const pelangganData = getPelangganData();
                const filename = exportCorrectedData(pelangganData);
                
                alert(
                    `Koreksi berhasil diterapkan!\n\n` +
                    `${corrections.length} pelanggan telah dikoreksi.\n` +
                    `File: ${filename}`
                );
                
                closeDialog();
            }
        };
    }
}

export async function processAutoCorrect(kecamatan, thresholdMeters = 50) {
    if (!kecamatan) {
        alert('Silakan pilih kecamatan terlebih dahulu!');
        return;
    }

    const pelangganData = getPelangganData();
    if (!pelangganData || pelangganData.length === 0) {
        alert('Data pelanggan belum dimuat!\n\nKlik "Show Pelanggan" terlebih dahulu.');
        return;
    }

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-autocorrect';
    loadingDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 24px 32px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        z-index: 10001;
        text-align: center;
    `;
    loadingDiv.innerHTML = `
        <div style="font-size: 14px; color: #333; margin-bottom: 12px;">
            Mencari bangunan terdekat...
        </div>
        <div style="font-size: 12px; color: #666;">
            Mohon tunggu sebentar
        </div>
    `;
    document.body.appendChild(loadingDiv);

    try {
        const corrections = await findNearestBuildings(kecamatan, thresholdMeters);
        document.body.removeChild(loadingDiv);
        showCorrectionDialog(corrections, kecamatan);
    } catch (error) {
        document.body.removeChild(loadingDiv);
        alert(`Error: ${error.message}`);
        console.error('[autocorrect-ui] Error:', error);
    }
}