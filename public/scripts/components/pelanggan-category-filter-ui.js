import { 
    filterByUsage, 
    filterByStatus, 
    clearCategoryFilters,
    getCurrentFilters
} from '../pelanggan/pelanggan-category-filter.js';
import { updateFilterDescription } from './pelanggan-filter-ui.js';

function onUsageFilterChange() {
    const select = document.getElementById('usageFilterSelect');
    if (select) {
        filterByUsage(select.value);
        updateFilterStats();
        updateCategoryFilterInBlokFilter();
        refreshCurrentBlokFilter();
    }
}

function onStatusFilterChange() {
    const select = document.getElementById('statusFilterSelect');
    if (select) {
        filterByStatus(select.value);
        updateFilterStats();
        updateCategoryFilterInBlokFilter();
        refreshCurrentBlokFilter();
    }
}

function onClearFilters() {
    const usageSelect = document.getElementById('usageFilterSelect');
    const statusSelect = document.getElementById('statusFilterSelect');
    
    if (usageSelect) usageSelect.value = 'all';
    if (statusSelect) statusSelect.value = 'all';
    
    const stats = clearCategoryFilters();
    updateFilterStatsDisplay(stats.visible, stats.hidden);
    updateCategoryFilterInBlokFilter();
    refreshCurrentBlokFilter();
}

function updateCategoryFilterInBlokFilter() {
    const categoryFilters = getCurrentFilters();
    updateFilterDescription(categoryFilters);
}

function refreshCurrentBlokFilter() {
    // Trigger refresh of blok filter if active
    const blokSelect = document.getElementById('blokFilterSelect');
    if (blokSelect && blokSelect.value) {
        // Trigger change event to refresh the filter
        blokSelect.dispatchEvent(new Event('change'));
    }
}

function updateFilterStats() {
    // Get current filter state and update display
    import('../pelanggan/pelanggan-category-filter.js').then(module => {
        const stats = module.getFilterStats();
        const hidden = stats.total - stats.visible;
        updateFilterStatsDisplay(stats.visible, hidden);
    });
}

function updateFilterStatsDisplay(visible, hidden) {
    const statsEl = document.getElementById('filterStatsDisplay');
    if (statsEl) {
        const total = visible + hidden;
        statsEl.innerHTML = `
            <div style="font-size: 11px; color: #666; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                Menampilkan: <strong style="color: #2e7d32;">${visible}</strong> dari ${total} pelanggan
                ${hidden > 0 ? `<span style="color: #c62828;"> (${hidden} tersembunyi)</span>` : ''}
            </div>
        `;
    }
}

export function createCategoryFilterControl() {
    const control = L.control({ position: 'topleft' });
    
    control.onAdd = function() {
        const container = L.DomUtil.create('div', 'pelanggan-category-filter-control');
        container.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            margin-top: 10px;
            min-width: 220px;
        `;

        // Title
        const title = L.DomUtil.create('div', '', container);
        title.style.cssText = `
            font-size: 13px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f0f0f0;
        `;
        title.textContent = 'Filter Kategori Pelanggan';

        // Usage Filter
        const usageLabel = L.DomUtil.create('div', '', container);
        usageLabel.style.cssText = `
            font-size: 11px;
            font-weight: 600;
            color: #666;
            margin-bottom: 4px;
            margin-top: 8px;
        `;
        usageLabel.textContent = 'Penggunaan Air';

        const usageSelect = L.DomUtil.create('select', '', container);
        usageSelect.id = 'usageFilterSelect';
        usageSelect.style.cssText = `
            width: 100%;
            padding: 8px;
            border: 2px solid #2196F3;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            color: #333;
            cursor: pointer;
            background: white;
            transition: all 0.2s ease;
            margin-bottom: 8px;
        `;

        usageSelect.innerHTML = `
            <option value="all">Semua Penggunaan</option>
            <option value="low">< 20 m³</option>
            <option value="high">≥ 20 m³</option>
        `;

        usageSelect.onchange = onUsageFilterChange;

        // Status Filter
        const statusLabel = L.DomUtil.create('div', '', container);
        statusLabel.style.cssText = `
            font-size: 11px;
            font-weight: 600;
            color: #666;
            margin-bottom: 4px;
            margin-top: 8px;
        `;
        statusLabel.textContent = 'Status Pembayaran';

        const statusSelect = L.DomUtil.create('select', '', container);
        statusSelect.id = 'statusFilterSelect';
        statusSelect.style.cssText = `
            width: 100%;
            padding: 8px;
            border: 2px solid #4CAF50;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            color: #333;
            cursor: pointer;
            background: white;
            transition: all 0.2s ease;
            margin-bottom: 8px;
        `;

        statusSelect.innerHTML = `
            <option value="all">Semua Status</option>
            <option value="lunas">Lunas</option>
            <option value="belum">Belum Lunas</option>
        `;

        statusSelect.onchange = onStatusFilterChange;

        // Stats Display
        const statsDisplay = L.DomUtil.create('div', '', container);
        statsDisplay.id = 'filterStatsDisplay';

        // Clear Button
        const btnClear = L.DomUtil.create('button', '', container);
        btnClear.innerHTML = 'Reset Filter';
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

        btnClear.onclick = onClearFilters;

        // Hover effects for selects
        [usageSelect, statusSelect].forEach(select => {
            select.onmouseover = () => {
                select.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.3)';
            };
            select.onmouseout = () => {
                select.style.boxShadow = 'none';
            };
        });

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        return container;
    };

    return control;
}

export function updateCategoryFilterStats() {
    updateFilterStats();
}