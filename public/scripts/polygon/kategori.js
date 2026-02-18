export const categories = {
    'lapangan_hijau': {
        name: 'Lapangan Hijau / Taman',
        color: '#518A4C',
        count: 0
    },
    'tempat_ibadah': {
        name: 'Tempat Ibadah',
        color: '#9C27B0',
        count: 0
    },
    'pendidikan': {
        name: 'Pendidikan',
        color: '#00f5d4',
        count: 0
    },
    'museum_wisata': {
        name: 'Museum / Wisata',
        color: '#e341a1',
        count: 0
    },
    'komersial': {
        name: 'Komersial / Industri',
        color: '#FF9800',
        count: 0
    },
    'kesehatan': {
        name: 'Kesehatan',
        color: '#F44336',
        count: 0
    },
    'pertanian': {
        name: 'Pertanian / Peternakan',
        color: '#795548',
        count: 0
    },
    'lainnya': {
        name: 'Lainnya',
        color: '#414141',
        count: 0
    }
};

export function getCategory(props) {
    if (props.leisure === 'park' || 
        props.leisure === 'pitch' || 
        props.leisure === 'stadium' ||
        props.sport === 'soccer') {
        return 'lapangan_hijau';
    }
    
    if (props.tourism === 'museum' ||
        props.tourism === 'gallery' ||
        props.tourism === 'attraction' ||
        props.tourism === 'artwork' ||
        props.amenity === 'arts_centre' ||
        props.amenity === 'community_centre' ||
        props.historic ||
        (props.name && (
            props.name.toLowerCase().includes('museum') ||
            props.name.toLowerCase().includes('galeri') ||
            props.name.toLowerCase().includes('gallery')
        ))) {
        return 'museum_wisata';
    }
    
    if (props.amenity === 'school' || 
        props.amenity === 'kindergarten' ||
        props.amenity === 'university' ||
        props.amenity === 'college' ||
        props.building === 'school' ||
        props.building === 'university' ||
        props.building === 'college' ||
        props.building === 'kindergarten' ||
        (props.name && (
            props.name.includes('Sekolah') ||
            props.name.includes('Pesantren') ||
            props.name.includes('SMK') ||
            props.name.includes('SMP') ||
            props.name.includes('SMA') ||
            props.name.includes('SD') ||
            props.name.includes('MA ') ||
            props.name.includes('MAN ') ||
            props.name.includes('MI.') ||
            props.name.includes('MTs') ||
            props.name.includes('Madrasah') ||
            props.name.includes('Universitas') ||
            props.name.includes('Institut') ||
            props.name.includes('Akademi') ||
            props.name.includes('Politeknik')
        ))) {
        return 'pendidikan';
    }
    
    if (props.amenity === 'place_of_worship' || 
        props.building === 'mosque' ||
        props.building === 'church' ||
        props.building === 'temple' ||
        props.building === 'cathedral' ||
        props.building === 'chapel' ||
        props.building === 'shrine' ||
        props.religion === 'muslim' ||
        props.religion === 'christian' ||
        props.religion === 'buddhist' ||
        props.religion === 'hindu') {
        return 'tempat_ibadah';
    }
    
    if (props.amenity === 'clinic' ||
        props.amenity === 'hospital' ||
        props.amenity === 'doctors' ||
        props.amenity === 'dentist' ||
        props.amenity === 'pharmacy' ||
        props.building === 'hospital' ||
        props.building === 'clinic' ||
        props.healthcare ||
        (props.name && (
            props.name.includes('Rumah Sakit') ||
            props.name.includes('RS ') ||
            props.name.includes('Klinik') ||
            props.name.includes('Puskesmas') ||
            props.name.includes('Posyandu')
        ))) {
        return 'kesehatan';
    }
    
    if (props.building === 'commercial' || 
        props.building === 'industrial' ||
        props.building === 'retail' ||
        props.building === 'warehouse' ||
        props.building === 'office' ||
        props.shop ||
        props.office) {
        return 'komersial';
    }
    
    if (props.building === 'farm_auxiliary' ||
        props.building === 'farm' ||
        props.building === 'barn' ||
        props.building === 'cowshed' ||
        props.building === 'greenhouse' ||
        props.building === 'sty' ||
        props.landuse === 'farmland' ||
        props.landuse === 'farmyard' ||
        props.landuse === 'landfill' ||
        props.amenity === 'animal_boarding' ||
        (props.name && (
            props.name.includes('Farmland') ||
            props.name.includes('Kambing') ||
            props.name.includes('Green House') ||
            props.name.includes('Peternakan') ||
            props.name.includes('Kandang')
        ))) {
        return 'pertanian';
    }
    
    return 'lainnya';
}

export function isBuilding(props) {
    return props.building !== undefined && props.building !== null;
}