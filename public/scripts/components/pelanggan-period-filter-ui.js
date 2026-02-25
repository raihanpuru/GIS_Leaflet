import { loadPelanggan } from '../pelanggan/pelanggan.js';

let currentPeriod = { bulan: null, tahun: null };

export function createPeriodFilterControl() {
    // Create inline filter elements instead of Leaflet control
    const dropdownContainer = document.querySelector('.dropdown-container');
    if (!dropdownContainer) {
        console.error('[period-filter] dropdown-container not found!');
        return null;
    }

    const container = document.createElement('div');
    container.className = 'period-filter-inline';
    container.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-left: 12px;
        padding-left: 12px;
        border-left: 2px solid #e0e0e0;
    `;

        // Bulan selector
        const bulanSelect = document.createElement('select');
        bulanSelect.id = 'bulanFilterSelect';
        bulanSelect.style.cssText = `
            padding: 8px 12px;
            border: 2px solid #4CAF50;
            border-radius: 5px;
            font-size: 14px;
            font-weight: 500;
            color: #333;
            cursor: pointer;
            background: white;
            min-width: 150px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        // Populate bulan options
        const bulanOptions = [
            { value: '', text: '-- Semua Bulan --' },
            { value: '1', text: 'Januari' },
            { value: '2', text: 'Februari' },
            { value: '3', text: 'Maret' },
            { value: '4', text: 'April' },
            { value: '5', text: 'Mei' },
            { value: '6', text: 'Juni' },
            { value: '7', text: 'Juli' },
            { value: '8', text: 'Agustus' },
            { value: '9', text: 'September' },
            { value: '10', text: 'Oktober' },
            { value: '11', text: 'November' },
            { value: '12', text: 'Desember' }
        ];

        bulanOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            bulanSelect.appendChild(option);
        });

        bulanSelect.onmouseover = () => {
            bulanSelect.style.borderColor = '#388E3C';
        };
        bulanSelect.onmouseout = () => {
            bulanSelect.style.borderColor = '#4CAF50';
        };

        container.appendChild(bulanSelect);

        // Tahun selector
        const tahunSelect = document.createElement('select');
        tahunSelect.id = 'tahunFilterSelect';
        tahunSelect.style.cssText = `
            padding: 8px 12px;
            border: 2px solid #2196F3;
            border-radius: 5px;
            font-size: 14px;
            font-weight: 500;
            color: #333;
            cursor: pointer;
            background: white;
            min-width: 120px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        // Populate tahun options (from 2020 to 2030)
        const tahunOptions = [{ value: '', text: '-- Semua Tahun --' }];
        const currentYear = new Date().getFullYear();
        for (let year = 2020; year <= 2030; year++) {
            tahunOptions.push({ value: year.toString(), text: year.toString() });
        }

        tahunOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            tahunSelect.appendChild(option);
        });

        tahunSelect.onmouseover = () => {
            tahunSelect.style.borderColor = '#1976D2';
        };
        tahunSelect.onmouseout = () => {
            tahunSelect.style.borderColor = '#2196F3';
        };

        container.appendChild(tahunSelect);

        // Event listeners untuk auto-apply filter saat berubah
        bulanSelect.onchange = () => {
            const bulan = bulanSelect.value ? parseInt(bulanSelect.value) : null;
            const tahun = tahunSelect.value ? parseInt(tahunSelect.value) : null;
            currentPeriod = { bulan, tahun };
            applyPeriodFilter(bulan, tahun);
        };

        tahunSelect.onchange = () => {
            const bulan = bulanSelect.value ? parseInt(bulanSelect.value) : null;
            const tahun = tahunSelect.value ? parseInt(tahunSelect.value) : null;
            currentPeriod = { bulan, tahun };
            applyPeriodFilter(bulan, tahun);
        };

        // Append to dropdown container
        dropdownContainer.appendChild(container);

        return container;
}

function applyPeriodFilter(bulan, tahun) {
    console.log('[period-filter] Applying period filter:', { bulan, tahun });
    
    // Reload pelanggan with period filter
    const params = new URLSearchParams();
    if (bulan) params.append('bulan', bulan);
    if (tahun) params.append('tahun', tahun);
    
    const queryString = params.toString();
    const url = queryString ? `/api/pelanggan?${queryString}` : '/api/pelanggan';
    
    console.log('[period-filter] Fetching from:', url);
    
    // Trigger reload
    loadPelanggan({ bulan, tahun });
}

function updateFilterDescription(bulan, tahun, descContainer) {
    if (!descContainer) {
        descContainer = document.getElementById('periodFilterDesc');
    }
    if (!descContainer) return;
    
    const parts = [];
    
    if (bulan) {
        const bulanNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                           'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        parts.push(`Bulan: ${bulanNames[bulan]}`);
    }
    
    if (tahun) {
        parts.push(`Tahun: ${tahun}`);
    }
    
    if (parts.length > 0) {
        descContainer.innerHTML = `
            <div style="font-weight: 600; color: #1565C0; font-size: 10px; margin-bottom: 3px;">
                Periode Aktif
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

export function getCurrentPeriod() {
    return currentPeriod;
}