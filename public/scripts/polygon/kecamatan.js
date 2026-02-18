export const kecamatanData = [
  { id: 'balongbendo', name: 'Balongbendo' },
  { id: 'buduran', name: 'Buduran' },
  { id: 'candi', name: 'Candi' },
  { id: 'gedangan', name: 'Gedangan' },
  { id: 'jabon', name: 'Jabon' },
  { id: 'krembung', name: 'Krembung' },
  { id: 'krian', name: 'Krian' },
  { id: 'porong', name: 'Porong' },
  { id: 'prambon', name: 'Prambon' },
  { id: 'sedati', name: 'Sedati' },
  { id: 'sidoarjo', name: 'Sidoarjo' },
  { id: 'sukodono', name: 'Sukodono' },
  { id: 'taman', name: 'Taman' },
  { id: 'tanggulangin', name: 'Tanggulangin' },
  { id: 'tarik', name: 'Tarik' },
  { id: 'tulangan', name: 'Tulangan' },
  { id: 'waru', name: 'Waru' },
  { id: 'wonoayu', name: 'Wonoayu' }
];

export function initKecamatanDropdown(selectElement, onChangeCallback) {
  if (!selectElement) {
    console.error('[kecamatan.js] Element select tidak ditemukan');
    return;
  }

  selectElement.innerHTML = '<option value="">-> Pilih Kecamatan <-</option>';

  kecamatanData.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.name;
    selectElement.appendChild(opt);
  });

  selectElement.addEventListener('change', (e) => {
    const kecamatan = e.target.value;
    if (kecamatan && onChangeCallback) {
      onChangeCallback(kecamatan);
    }
  });

  console.log('[kecamatan.js] Dropdown initialized');
}