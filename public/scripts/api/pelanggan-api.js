// API Client for Pelanggan Backend
export class PelangganAPI {
    constructor(baseURL = '') {
        this.baseURL = baseURL || window.location.origin;
        this.apiURL = `${this.baseURL}/api`;
    }

    // Helper method for fetch requests
    async request(endpoint, options = {}) {
        const url = `${this.apiURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // Get all pelanggan with optional filters
    async getAll(filters = {}) {
        const params = new URLSearchParams();
        
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
                params.append(key, filters[key]);
            }
        });

        const queryString = params.toString();
        const endpoint = `/pelanggan${queryString ? '?' + queryString : ''}`;
        
        return this.request(endpoint);
    }

    // Search pelanggan
    async search(searchTerm) {
        if (!searchTerm) {
            return { success: true, count: 0, data: [] };
        }
        
        return this.request(`/pelanggan/search?q=${encodeURIComponent(searchTerm)}`);
    }

    // Get pelanggan within radius
    async getNearby(longitude, latitude, radius = 500) {
        const params = new URLSearchParams({
            lng: longitude,
            lat: latitude,
            radius: radius,
        });
        
        return this.request(`/pelanggan/nearby?${params.toString()}`);
    }

    // Get pelanggan by ID
    async getById(id) {
        return this.request(`/pelanggan/${id}`);
    }

    // Get statistics
    async getStats() {
        return this.request('/pelanggan/stats');
    }

    // Create new pelanggan
    async create(data) {
        return this.request('/pelanggan', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Update pelanggan
    async update(id, data) {
        return this.request(`/pelanggan/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    // Delete pelanggan
    async delete(id) {
        return this.request(`/pelanggan/${id}`, {
            method: 'DELETE',
        });
    }

    static toGeoJSON(pelangganData) {
        if (!Array.isArray(pelangganData)) {
            pelangganData = [pelangganData];
        }

        return {
            type: 'FeatureCollection',
            features: pelangganData.map(p => ({
                type: 'Feature',
                id: p.id,
                geometry: p.location || {
                    type: 'Point',
                    coordinates: [p.longitude, p.latitude]
                },
                properties: {
                    id: p.id,
                    nosambungan: p.nosambungan,
                    idpelanggan: p.idpelanggan,
                    nopelanggan: p.nopelanggan,
                    nama: p.nama,
                    alamat: p.alamat,
                    noalamat: p.noalamat,
                    nourut: p.nourut,
                }
            }))
        };
    }

    static toLegacyFormat(pelangganData) {
        if (!Array.isArray(pelangganData)) {
            pelangganData = [pelangganData];
        }

        return pelangganData.map(p => ({
            _db_id: p.id,    
            nosambungan: p.nosambungan,
            idpelanggan: p.idpelanggan,
            nopelanggan: p.nopelanggan,
            nama: p.nama,
            alamat: p.alamat,
            noalamat: p.noalamat,
            nourut: p.nourut,
            pakai: p.pakai,
            tagihan: p.tagihan,
            tglbayar: p.tglbayar,
            lunas: p.lunas,
            Long: p.longitude,
            Lat: p.latitude,
            bulan: p.bulan,    
            tahun: p.tahun,       
        }));
    }
}

export const pelangganAPI = new PelangganAPI();