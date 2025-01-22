const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuración
const INPUT_FILE = 'docs/cie10/DIAGNOSTICOS_20240416.xlsx'; // Reemplaza con el nombre de tu archivo
const TABLE_NAME = 'cie_10'; // Reemplaza con el nombre deseado para la tabla
const DDL_FILE = 'create_table.sql';
const DML_FILE = 'insert_data.sql';
const BATCH_SIZE = 1000;

// Función para determinar el tipo de dato de MySQL y tamaño para VARCHAR
function determineColumnType(values, header) {
    let isInt = true;
    let isFloat = true;
    let isDate = true;
    let maxLength = 0;

    for (let value of values) {
        if (value === null || value === undefined || value === '') continue;
        // Verificar si es entero
        if (isInt && !Number.isInteger(Number(value))) {
            isInt = false;
        }
        // Verificar si es float
        if (isFloat && isNaN(Number(value))) {
            isFloat = false;
        }
        // Verificar si es fecha
        const date = new Date(value);
        if (isDate && isNaN(date.getTime())) {
            isDate = false;
        }
        // Calcular la longitud máxima para VARCHAR
        if (typeof value === 'string') {
            const length = value.length;
            if (length > maxLength) {
                maxLength = length;
            }
        }
        // Si ya no es ninguno, salir
        if (!isInt && !isFloat && !isDate) {
            // Continuar para calcular maxLength si es VARCHAR
            continue;
        }
    }

    if (isInt) return 'INT';
    if (isFloat) return 'DOUBLE';
    if (isDate) return 'DATE';
    // Definir un tamaño razonable para VARCHAR basado en maxLength
    // Puedes establecer un límite superior si lo deseas
    const varcharSize = Math.min(Math.max(maxLength, 1), 255); // Máximo 255
    return `VARCHAR(${varcharSize})`;
}

// Leer el archivo Excel
const workbook = XLSX.readFile(INPUT_FILE);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });

// Si no hay datos, salir
if (jsonData.length === 0) {
    console.error('No se encontraron datos en el archivo Excel.');
    process.exit(1);
}

// Obtener las cabeceras
const headers = Object.keys(jsonData[0]);

// Determinar los tipos de columnas con tamaños ajustados
const columnTypes = {};
headers.forEach(header => {
    const values = jsonData.map(row => row[header]);
    columnTypes[header] = determineColumnType(values, header);
});

// Generar el DDL
let ddl = `CREATE TABLE \`${TABLE_NAME}\` (\n`;
headers.forEach((header, index) => {
    ddl += `  \`${header}\` ${columnTypes[header]}`;
    ddl += index < headers.length - 1 ? ',\n' : '\n';
});
ddl += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n`;

// Escribir el DDL a un archivo
fs.writeFileSync(DDL_FILE, ddl);
console.log(`DDL generado en ${DDL_FILE}`);

// Generar el DML
let dml = '';
let batch = [];
jsonData.forEach((row, rowIndex) => {
    // Escapar y formatear los valores
    const values = headers.map(header => {
        let value = row[header];
        if (value === null || value === undefined) {
            return 'NULL';
        }
        // Verificar el tipo de dato
        if (columnTypes[header] === 'INT' || columnTypes[header] === 'DOUBLE') {
            return value;
        }
        if (columnTypes[header].startsWith('VARCHAR')) {
            // Para cadenas de texto, escapar comillas simples
            const escaped = String(value).replace(/'/g, "''");
            return `'${escaped}'`;
        }
        if (columnTypes[header] === 'DATE') {
            // Formatear la fecha a 'YYYY-MM-DD'
            const date = new Date(value);
            const formattedDate = isNaN(date.getTime()) ? 'NULL' : `'${date.toISOString().split('T')[0]}'`;
            return formattedDate;
        }
        // Por defecto, tratar como cadena
        const escaped = String(value).replace(/'/g, "''");
        return `'${escaped}'`;
    });

    batch.push(`(${values.join(', ')})`);

    // Cuando el batch alcanza el tamaño definido, agregar al DML
    if ((rowIndex + 1) % BATCH_SIZE === 0 || rowIndex === jsonData.length - 1) {
        dml += `INSERT INTO \`${TABLE_NAME}\` (${headers.map(h => `\`${h}\``).join(', ')}) VALUES\n`;
        dml += batch.join(',\n') + ';\n';
        batch = [];
    }
});

// Escribir el DML a un archivo
fs.writeFileSync(DML_FILE, dml);
console.log(`DML generado en ${DML_FILE}`);
