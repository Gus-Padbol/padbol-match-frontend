const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/i18n/locales');
const langs = ['es', 'en', 'it', 'ro', 'de', 'fr', 'pt'];

function flatten(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flatten(obj[key], fullKey));
    } else {
      acc[fullKey] = String(obj[key]);
    }
    return acc;
  }, {});
}

const data = {};
langs.forEach(lang => {
  const file = path.join(localesDir, `${lang}.json`);
  data[lang] = fs.existsSync(file) ? flatten(JSON.parse(fs.readFileSync(file, 'utf8'))) : {};
});

const keys = Object.keys(data.es).sort();
const wb = XLSX.utils.book_new();

// Hoja EN: Español → Inglés
const enRows = [['Español', 'Inglés actual', 'Corrección EN']];
keys.forEach(k => enRows.push([data.es[k] || '', data.en[k] || '', '']));
const wsEN = XLSX.utils.aoa_to_sheet(enRows);
wsEN['!cols'] = [{wch: 48}, {wch: 48}, {wch: 40}];
XLSX.utils.book_append_sheet(wb, wsEN, 'EN review');

// Hojas por idioma: Inglés → idioma
['it', 'ro', 'de', 'fr', 'pt'].forEach(lang => {
  const rows = [['Inglés (base)', 'Traducción actual', 'Corrección nativa']];
  keys.forEach(k => rows.push([data.en[k] || '', data[lang][k] || '', '']));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch: 48}, {wch: 48}, {wch: 40}];
  XLSX.utils.book_append_sheet(wb, ws, `${lang.toUpperCase()} review`);
});

const date = new Date().toISOString().split('T')[0];
const out = path.join(__dirname, `../i18n-revision-${date}.xlsx`);
XLSX.write(wb, { bookType: 'xlsx', type: 'file', file: out });
console.log(`Generado: ${out}`);
