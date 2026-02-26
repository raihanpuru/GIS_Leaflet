/**
 * Loading overlay utility
 * Menampilkan spinner fullscreen saat fetch data ke server
 * + Welcome info box instruksi filter bulan/tahun
 */

let activeCount = 0;
let showTimestamp = 0;
const MIN_VISIBLE_MS = 300; // minimum loading tampil agar tidak kedip

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

    // Force reflow agar transition opacity berjalan dari 0
    overlay.classList.remove('visible');
    void overlay.offsetHeight; // trigger reflow
    overlay.classList.add('visible');

    showTimestamp = Date.now();
}

export function hideLoading() {
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount > 0) return;

    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;

    // Pastikan loading tampil minimal MIN_VISIBLE_MS ms agar tidak kedip
    const elapsed = Date.now() - showTimestamp;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    setTimeout(() => {
        if (activeCount === 0) {
            overlay.classList.remove('visible');
        }
    }, remaining);
}