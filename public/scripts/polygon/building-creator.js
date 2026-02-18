import { getMap } from '../polygon/polygon.js';
import { categories, getCategory } from '../polygon/kategori.js';

let isAddingMode = false;
let tempMarker = null;
let newBuildings = [];
let currentKecamatanName = null;

export function toggleAddBuildingMode() {
    isAddingMode = !isAddingMode;
    const map = getMap();
    
    if (isAddingMode) {
        map.getContainer().style.cursor = 'crosshair';
        console.log('[building-creator] Mode tambah bangunan aktif - Klik di peta untuk menandai lokasi');
    } else {
        map.getContainer().style.cursor = '';
        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }
        console.log('[building-creator] Mode tambah bangunan nonaktif');
    }
    
    return isAddingMode;
}

export function setActiveKecamatan(kecamatan) {
    currentKecamatanName = kecamatan;
}

export function handleMapClick(e) {
    if (!isAddingMode) return;
    
    const map = getMap();
    const latlng = e.latlng;
    
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }
    
    tempMarker = L.circleMarker(latlng, {
        radius: 8,
        fillColor: '#ff9800',
        color: '#e65100',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);
    
    tempMarker.bindPopup('Lokasi bangunan baru').openPopup();
    
    showBuildingForm(latlng);
}

function createRotatedPreview(latlng, width, height, rotation) {
    const map = getMap();
    
    const metersToLat = height / 111000;
    const metersToLng = width / (111000 * Math.cos(latlng.lat * Math.PI / 180));

    const baseCoords = [
        [-metersToLng/2, -metersToLat/2],
        [metersToLng/2, -metersToLat/2],
        [metersToLng/2, metersToLat/2],
        [-metersToLng/2, metersToLat/2],
        [-metersToLng/2, -metersToLat/2]
    ];

    const rotatePoint = (x, y, angle) => {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return {
            x: x * cos - y * sin,
            y: x * sin + y * cos
        };
    };

    const rotatedCoords = baseCoords.map(([x, y]) => {
        const rotated = rotatePoint(x, y, rotation);
        return [latlng.lat + rotated.y, latlng.lng + rotated.x];
    });

    const preview = L.polygon(rotatedCoords, {
        color: '#2196F3',
        weight: 2,
        opacity: 0.8,
        fillColor: '#2196F3',
        fillOpacity: 0.2,
        dashArray: '5, 5'
    }).addTo(map);

    return preview;
}

function showBuildingForm(latlng) {
    const overlay = document.createElement('div');
    overlay.id = 'building-form-overlay';
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

    const formContainer = document.createElement('div');
    formContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    formContainer.innerHTML = `
        <h2 style="margin: 0 0 16px 0; color: #ff9800; font-size: 20px;">
            Tambah Bangunan Baru
        </h2>
        
        <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
            <div style="font-size: 12px; color: #666;">
                <strong>Koordinat:</strong> ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}
            </div>
        </div>

        <form id="buildingForm">
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: #333;">
                    Nama Bangunan *
                </label>
                <input type="text" id="buildingName" required 
                    style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
                    placeholder="Contoh: Gedung Serbaguna">
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: #333;">
                    Tipe Bangunan *
                </label>
                <select id="buildingType" required
                    style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                    <option value="">-- Pilih Tipe --</option>
                    <option value="commercial">Commercial (Komersial)</option>
                    <option value="school">School (Sekolah)</option>
                    <option value="university">University (Universitas)</option>
                    <option value="hospital">Hospital (Rumah Sakit)</option>
                    <option value="clinic">Clinic (Klinik)</option>
                    <option value="mosque">Mosque (Masjid)</option>
                    <option value="church">Church (Gereja)</option>
                    <option value="temple">Temple (Vihara/Pura)</option>
                    <option value="industrial">Industrial (Industri)</option>
                    <option value="warehouse">Warehouse (Gudang)</option>
                    <option value="office">Office (Kantor)</option>
                    <option value="retail">Retail (Toko)</option>
                    <option value="farm">Farm (Pertanian)</option>
                    <option value="greenhouse">Greenhouse (Rumah Kaca)</option>
                    <option value="residential">Residential (Rumah)</option>
                    <option value="apartments">Apartments (Apartemen)</option>
                    <option value="yes">Yes (Bangunan Umum)</option>
                </select>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: #333;">
                    Amenity (Opsional)
                </label>
                <select id="buildingAmenity"
                    style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                    <option value="">-- Tidak Ada --</option>
                    <option value="school">School</option>
                    <option value="university">University</option>
                    <option value="hospital">Hospital</option>
                    <option value="clinic">Clinic</option>
                    <option value="place_of_worship">Place of Worship</option>
                    <option value="community_centre">Community Centre</option>
                    <option value="arts_centre">Arts Centre</option>
                </select>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: #333;">
                    Ukuran Bangunan (meter)
                </label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <input type="number" id="buildingWidth" placeholder="Lebar" min="1" value="20"
                            style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div>
                        <input type="number" id="buildingHeight" placeholder="Panjang" min="1" value="20"
                            style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                    </div>
                </div>
                <div style="font-size: 11px; color: #666; margin-top: 4px;">
                    Ukuran untuk membuat kotak bangunan di peta
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: #333;">
                    Rotasi Bangunan: <span id="rotationValue" style="color: #ff9800;">0°</span>
                </label>
                <input type="range" id="buildingRotation" min="0" max="360" value="0" step="1"
                    style="width: 100%; height: 8px; border-radius: 5px; background: linear-gradient(to right, #ddd 0%, #ff9800 50%, #ddd 100%); outline: none; -webkit-appearance: none;"
                    oninput="document.getElementById('rotationValue').textContent = this.value + '°'">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999; margin-top: 4px;">
                    <span>0° (Utara)</span>
                    <span>90° (Timur)</span>
                    <span>180° (Selatan)</span>
                    <span>270° (Barat)</span>
                </div>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button type="button" id="btnCancelForm" style="
                    background: #f5f5f5;
                    color: #666;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    padding: 10px 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">Batal</button>
                <button type="submit" style="
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 10px 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">Tambahkan</button>
            </div>
        </form>
    `;

    overlay.appendChild(formContainer);
    document.body.appendChild(overlay);

    let previewLayer = null;
    const rotationSlider = formContainer.querySelector('#buildingRotation');
    const widthInput = formContainer.querySelector('#buildingWidth');
    const heightInput = formContainer.querySelector('#buildingHeight');
    
    const updatePreview = () => {
        const rotation = parseFloat(rotationSlider.value) || 0;
        const width = parseFloat(widthInput.value) || 20;
        const height = parseFloat(heightInput.value) || 20;
        
        if (previewLayer) {
            map.removeLayer(previewLayer);
        }
        
        previewLayer = createRotatedPreview(latlng, width, height, rotation);
    };
    
    rotationSlider.addEventListener('input', updatePreview);
    widthInput.addEventListener('input', updatePreview);
    heightInput.addEventListener('input', updatePreview);
    
    updatePreview();

    const form = document.getElementById('buildingForm');
    const btnCancel = document.getElementById('btnCancelForm');

    btnCancel.onclick = () => {
        closeForm();
    };

    form.onsubmit = (e) => {
        e.preventDefault();
        
        const name = document.getElementById('buildingName').value.trim();
        const buildingType = document.getElementById('buildingType').value;
        const amenity = document.getElementById('buildingAmenity').value;
        const width = parseFloat(document.getElementById('buildingWidth').value) || 20;
        const height = parseFloat(document.getElementById('buildingHeight').value) || 20;
        const rotation = parseFloat(document.getElementById('buildingRotation').value) || 0;

        addNewBuilding(latlng, name, buildingType, amenity, width, height, rotation);
        closeForm();
    };

    function closeForm() {
        const map = getMap();
        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }
        if (previewLayer) {
            map.removeLayer(previewLayer);
            previewLayer = null;
        }
        document.body.removeChild(overlay);
    }
}

function addNewBuilding(latlng, name, buildingType, amenity, width, height, rotation = 0) {
    const map = getMap();
    
    const metersToLat = height / 111000; 
    const metersToLng = width / (111000 * Math.cos(latlng.lat * Math.PI / 180));

    const baseCoords = [
        [-metersToLng/2, -metersToLat/2],
        [metersToLng/2, -metersToLat/2],   
        [metersToLng/2, metersToLat/2],  
        [-metersToLng/2, metersToLat/2], 
        [-metersToLng/2, -metersToLat/2]  
    ];

    const rotatePoint = (x, y, angle) => {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return {
            x: x * cos - y * sin,
            y: x * sin + y * cos
        };
    };

    const rotatedCoords = baseCoords.map(([x, y]) => {
        const rotated = rotatePoint(x, y, rotation);
        return [latlng.lng + rotated.x, latlng.lat + rotated.y];
    });

    const feature = {
        type: "Feature",
        properties: {
            name: name,
            building: buildingType,
            ...(amenity && { amenity: amenity }),
            "addr:city": "Sidoarjo",
            source: "manual_input",
            created_at: new Date().toISOString(),
            rotation: rotation 
        },
        geometry: {
            type: "Polygon",
            coordinates: [rotatedCoords]
        }
    };

    const category = getCategory(feature.properties);
    const cat = categories[category];

    const layer = L.geoJSON(feature, {
        style: {
            fillColor: cat.color,
            weight: 2,
            opacity: 1,
            color: '#ff9800',
            fillOpacity: 0.6,
            dashArray: '5, 5'
        },
        onEachFeature: function(feature, layer) {
            const bounds = layer.getBounds();
            const center = bounds.getCenter();
            
            const popupContent = `
                <div style="font-size: 12px;">
                    <div style="background: #ff9800; color: white; padding: 4px 8px; margin: -8px -8px 8px -8px; border-radius: 4px 4px 0 0;">
                        <strong>🆕 Bangunan Baru</strong>
                    </div>
                    <strong>Kategori:</strong> ${cat.name}<br>
                    <strong>Nama:</strong> ${name}<br>
                    <strong>Building:</strong> ${buildingType}<br>
                    ${amenity ? `<strong>Amenity:</strong> ${amenity}<br>` : ''}
                    <strong>Ukuran:</strong> ${width}m × ${height}m<br>
                    ${rotation > 0 ? `<strong>Rotasi:</strong> ${rotation}°<br>` : ''}
                    <strong>Koordinat:</strong><br>
                    Lat: ${center.lat.toFixed(6)}<br>
                    Long: ${center.lng.toFixed(6)}
                </div>
            `;
            
            layer.bindPopup(popupContent);
        }
    }).addTo(map);

    newBuildings.push(feature);
    categories[category].count++;

    if (typeof window.updateBuildingCounter === 'function') {
        window.updateBuildingCounter();
    }

    console.log(`[building-creator] Bangunan baru ditambahkan: ${name} (${buildingType})`);
    showNotification(`Bangunan "${name}" berhasil ditambahkan!`);
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: #4CAF50;
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10001;
        font-size: 14px;
        font-weight: 600;
        animation: slideDown 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

export async function downloadUpdatedGeoJSON(kecamatan) {
    if (!kecamatan) {
        alert('Silakan pilih kecamatan terlebih dahulu!');
        return;
    }

    if (newBuildings.length === 0) {
        alert('Tidak ada bangunan baru yang ditambahkan!');
        return;
    }

    try {
        const geojsonPath = `kecamatan/${kecamatan}.geojson`;
        const response = await fetch(geojsonPath);
        
        if (!response.ok) {
            throw new Error(`File tidak ditemukan: ${geojsonPath}`);
        }
        
        const originalData = await response.json();
        
        const updatedData = {
            ...originalData,
            features: [...originalData.features, ...newBuildings]
        };

        const blob = new Blob([JSON.stringify(updatedData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `${kecamatan}_updated_${timestamp}.geojson`;
        
        link.href = url;
        link.download = filename;
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`[building-creator] GeoJSON downloaded: ${filename}`);
        alert(`GeoJSON berhasil didownload!\n\nFile: ${filename}\nTotal bangunan baru: ${newBuildings.length}`);
        
    } catch (error) {
        console.error('[building-creator] Error:', error);
        alert(`Error: ${error.message}`);
    }
}

export function clearNewBuildings() {
    const confirmed = confirm(
        `Yakin ingin menghapus ${newBuildings.length} bangunan baru?\n\n` +
        `Data yang belum di-download akan hilang!`
    );
    
    if (confirmed) {
        newBuildings = [];
        console.log('[building-creator] Semua bangunan baru telah dihapus');
        showNotification('Semua bangunan baru telah dihapus');
    }
}

export function getNewBuildingsCount() {
    return newBuildings.length;
}

export function isInAddingMode() {
    return isAddingMode;
}