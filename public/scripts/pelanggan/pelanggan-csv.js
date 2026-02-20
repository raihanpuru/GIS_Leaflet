function parseCsvRow(row) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '"') {
            if (inQuotes && row[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current.trim());
    return fields;
}

export function parseCsv(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const headers = parseCsvRow(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields = parseCsvRow(line);
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = fields[idx] || '';
        });
        data.push(obj);
    }
    return data;
}

export function isValidCoord(row) {
    const lat = parseFloat(row['Lat']);
    const lng = parseFloat(row['Long']);
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < -8 || lat > -7 || lng < 112 || lng > 113) return false;
    return true;
}

const EXCLUDED_KEYS = ['_db_id'];

const COLUMN_ORDER = [
    'nosambungan', 'idpelanggan', 'nopelanggan', 'nama',
    'alamat', 'noalamat', 'nourut',
    'pakai', 'tagihan', 'tglbayar', 'lunas',
    'Lat', 'Long',
    'bulan', 'tahun',
];

export function generateCSV(data) {
    if (!data || data.length === 0) return '';

    const allKeys = Object.keys(data[0]).filter(k => !EXCLUDED_KEYS.includes(k));
    const ordered = COLUMN_ORDER.filter(k => allKeys.includes(k));
    const rest    = allKeys.filter(k => !COLUMN_ORDER.includes(k));
    const headers = [...ordered, ...rest];

    const escapeCell = val => {
        const str = String(val ?? '');
        return (str.includes(',') || str.includes('"') || str.includes('\n'))
            ? '"' + str.replace(/"/g, '""') + '"'
            : str;
    };

    const rows = [
        headers.join(','),
        ...data.map(row => headers.map(h => escapeCell(row[h])).join(','))
    ];

    return rows.join('\n') + '\n';
}

export function downloadCSV(data, filename = 'pelanggan') {
    const csvContent = generateCSV(data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_updated_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`[pelanggan-csv.js] CSV downloaded: ${filename}_updated_${timestamp}.csv`);
    return `${filename}_updated_${timestamp}.csv`;
}