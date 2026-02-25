/**
 * Loading overlay utility
 * Menampilkan spinner fullscreen saat fetch data ke server
 * + Welcome info box instruksi filter bulan/tahun
 */

let activeCount = 0;

// ─── Welcome Info Box ─────────────────────────────────────────────────────────

export function showWelcomeModal() {
    if (document.getElementById('welcome-info')) return;

    const box = document.createElement('div');
    box.id = 'welcome-info';
    box.textContent = 'Pilih bulan dan tahun periode pelanggan';
    document.body.appendChild(box);
}

export function hideWelcomeModal() {
    const box = document.getElementById('welcome-info');
    if (!box) return;
    box.classList.add('hiding');
    setTimeout(() => box.remove(), 300);
}

// ─── Loading Overlay ──────────────────────────────────────────────────────────

function getOrCreateOverlay() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-box">
                <div class="loading-spinner"></div>
                <div class="loading-text">Memuat data...</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    return overlay;
}

export function showLoading(message = 'Memuat data...') {
    activeCount++;
    const overlay = getOrCreateOverlay();
    const textEl = overlay.querySelector('.loading-text');
    if (textEl) textEl.textContent = message;
    overlay.classList.add('visible');
}

export function hideLoading() {
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount === 0) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('visible');
    }
}