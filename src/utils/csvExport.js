function cellValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? (item.name || item.url || item.id || JSON.stringify(item)) : item).join(' | ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function flatten(record, prefix = '', output = {}) {
  Object.entries(record || {}).forEach(([key, value]) => {
    const heading = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, heading, output);
    else output[heading] = cellValue(value);
  });
  return output;
}

function escapeCsv(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportRowsToCsv(rows, filename) {
  const flattened = (rows || []).map(row => flatten(row));
  if (!flattened.length) return false;
  const headers = [...new Set(flattened.flatMap(row => Object.keys(row)))];
  const csv = '\uFEFF' + [
    headers.map(escapeCsv).join(','),
    ...flattened.map(row => headers.map(header => escapeCsv(row[header])).join(','))
  ].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  return true;
}
