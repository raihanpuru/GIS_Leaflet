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

export function generateCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    let csvContent = headers.join(',') + '\n';

    data.forEach(row => {
        const values = headers.map(h => {
            let val = String(row[h] || '');
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        });
        csvContent += values.join(',') + '\n';
    });

    return csvContent;
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