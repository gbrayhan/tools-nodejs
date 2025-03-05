const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const INPUT_FILE = './docs/mexico-zip-codes/CPdescarga.xls';
const TABLE_NAME = 'mexico_zip_codes';
const DDL_FILE = './docs/mexico-zip-codes/create_table.sql';
const DML_FILE = './docs/mexico-zip-codes/insert_data.sql';
const BATCH_SIZE = 1000;
const workbook = XLSX.readFile(INPUT_FILE);
let allData = [];
workbook.SheetNames.forEach(sheetName => {
  if (sheetName.toLowerCase() === 'nota') return;
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });
  jsonData.forEach(row => {
    row['d_estado'] = sheetName;
    allData.push(row);
  });
});
if (allData.length === 0) {
  console.error('No se encontraron datos en el archivo Excel.');
  process.exit(1);
}
const headers = Object.keys(allData[0]);
const columnTypes = {
  d_codigo: 'VARCHAR(10)',
  d_asenta: 'VARCHAR(100)',
  d_tipo_asenta: 'VARCHAR(100)',
  D_mnpio: 'VARCHAR(100)',
  d_estado: 'VARCHAR(100)',
  d_ciudad: 'VARCHAR(100)',
  d_CP: 'VARCHAR(10)',
  c_estado: 'VARCHAR(10)',
  c_oficina: 'VARCHAR(10)',
  c_CP: 'VARCHAR(10)',
  c_tipo_asenta: 'VARCHAR(50)',
  c_mnpio: 'VARCHAR(10)',
  id_asenta_cpcons: 'VARCHAR(10)',
  d_zona: 'VARCHAR(50)',
  c_cve_ciudad: 'VARCHAR(10)'
};
let ddl = `CREATE TABLE \`${TABLE_NAME}\` (\n`;
headers.forEach((header, index) => {
  let type = columnTypes[header] || 'VARCHAR(255)';
  ddl += `  \`${header}\` ${type}`;
  ddl += index < headers.length - 1 ? ',\n' : '\n';
});
ddl += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n';
fs.writeFileSync(DDL_FILE, ddl);
console.log(`DDL generado en ${DDL_FILE}`);
function formatValue(value, type) {
  if (value === null || value === undefined || value === '') {
    return 'NULL';
  }
  if (type.startsWith('VARCHAR')) {
    const escaped = String(value).replace(/'/g, "''");
    return `'${escaped}'`;
  }
  return `'${value}'`;
}
let dml = '';
let batch = [];
allData.forEach((row, rowIndex) => {
  const values = headers.map(header => formatValue(row[header], columnTypes[header] || 'VARCHAR(255)'));
  batch.push(`(${values.join(', ')})`);
  if ((rowIndex + 1) % BATCH_SIZE === 0 || rowIndex === allData.length - 1) {
    dml += `INSERT INTO ${TABLE_NAME} (${headers.map(h => `${h}`).join(', ')}) VALUES\n`;
    dml += batch.join(',\n') + ';\n';
    batch = [];
  }
});
fs.writeFileSync(DML_FILE, dml);
console.log(`DML generado en ${DML_FILE}`);
