const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuración
const INPUT_FILE = 'docs/cie10/DIAGNOSTICOS_20240416.xlsx'; // Reemplaza con el nombre de tu archivo
const TABLE_NAME = 'cie_10'; // Reemplaza con el nombre deseado para la tabla
const DDL_FILE = 'create_table.sql';
const DML_FILE = 'insert_data.sql';
const BATCH_SIZE = 1000;

// Definir los tipos de columnas según el esquema proporcionado
const columnTypes = {
    'CONSECUTIVO': 'INT',
    'LETRA': 'VARCHAR(1)',
    'CATALOG_KEY': 'VARCHAR(4)',
    'NO. CARACTERES': 'INT',
    'NOMBRE': 'VARCHAR(241)',
    'CODIGOX': 'VARCHAR(2)',
    'LSEX': 'VARCHAR(6)',
    'LINF': 'VARCHAR(4)',
    'LSUP': 'VARCHAR(4)',
    'TRIVIAL': 'VARCHAR(2)',
    'ERRADICADO': 'VARCHAR(2)',
    'N_INTER': 'VARCHAR(2)',
    'NIN': 'VARCHAR(2)',
    'NINMTOBS': 'VARCHAR(2)',
    'COD_SIT_LESION': 'VARCHAR(2)',
    'NO_CBD': 'VARCHAR(2)',
    'CBD': 'VARCHAR(2)',
    'NO_APH': 'VARCHAR(2)',
    'AF_PRIN': 'VARCHAR(2)',
    'DIA_SIS': 'VARCHAR(2)',
    'CLAVE_PROGRAMA_SIS': 'VARCHAR(2)',
    'COD_COMPLEMEN_MORBI': 'VARCHAR(2)',
    'DIA_FETAL': 'VARCHAR(2)',
    'DEF_FETAL_CM': 'VARCHAR(2)',
    'DEF_FETAL_CBD': 'VARCHAR(2)',
    'CLAVE_CAPITULO': 'VARCHAR(5)',
    'CAPITULO': 'VARCHAR(121)',
    'LISTA1': 'VARCHAR(3)',
    'GRUPO1': 'VARCHAR(3)',
    'LISTA5': 'VARCHAR(3)',
    'RUBRICA_TYPE': 'VARCHAR(3)',
    'YEAR_MODIFI': 'VARCHAR(189)',
    'YEAR_APLICACION': 'VARCHAR(100)',
    'VALID': 'VARCHAR(2)',
    'PRINMORTA': 'VARCHAR(4)',
    'PRINMORBI': 'VARCHAR(4)',
    'LM_MORBI': 'VARCHAR(4)',
    'LM_MORTA': 'VARCHAR(4)',
    'LGBD165': 'VARCHAR(200)',
    'LOMSBECK': 'VARCHAR(100)',
    'LGBD190': 'VARCHAR(100)',
    'NOTDIARIA': 'VARCHAR(2)',
    'NOTSEMANAL': 'VARCHAR(2)',
    'SISTEMA_ESPECIAL': 'VARCHAR(2)',
    'BIRMM': 'VARCHAR(2)',
    'CVE_CAUSA_TYPE': 'VARCHAR(2)',
    'CAUSA_TYPE': 'VARCHAR(41)',
    'EPI_MORTA': 'VARCHAR(2)',
    'EDAS_E_IRAS_EN_M5': 'VARCHAR(2)',
    'CVE_MATERNAS-SEED-EPID': 'VARCHAR(2)',
    'EPI_MORTA_M5': 'VARCHAR(2)',
    'EPI_MORBI': 'VARCHAR(2)',
    'DEF_MATERNAS': 'INT',
    'ES_CAUSES': 'VARCHAR(2)',
    'NUM_CAUSES': 'VARCHAR(100)',
    'ES_SUIVE_MORTA': 'VARCHAR(2)',
    'ES_SUIVE_MORB': 'VARCHAR(2)',
    'EPI_CLAVE': 'VARCHAR(5)',
    'EPI_CLAVE_DESC': 'VARCHAR(98)',
    'ES_SUIVE_NOTIN': 'VARCHAR(2)',
    'ES_SUIVE_EST_EPI': 'VARCHAR(2)',
    'ES_SUIVE_EST_BROTE': 'VARCHAR(2)',
    'SINAC': 'VARCHAR(2)',
    'PRIN_SINAC': 'VARCHAR(2)',
    'PRIN_SINAC_GRUPO': 'VARCHAR(2)',
    'DESCRIPCION_SINAC_GRUPO': 'VARCHAR(143)',
    'PRIN_SINAC_SUBGRUPO': 'VARCHAR(3)',
    'DESCRIPCION_SINAC_SUBGRUPO': 'VARCHAR(153)',
    'DAGA': 'VARCHAR(2)',
    'ASTERISCO': 'VARCHAR(2)',
    'PRIN_MM': 'VARCHAR(2)',
    'PRIN_MM_GRUPO': 'VARCHAR(2)',
    'DESCRIPCION_MM_GRUPO': 'VARCHAR(84)',
    'PRIN_MM_SUBGRUPO': 'VARCHAR(100)',
    'DESCRIPCION_MM_SUBGRUPO': 'VARCHAR(92)',
    'COD_ADI_MORT': 'VARCHAR(2)',
    '__EMPTY': 'INT',
    '__EMPTY_1': 'INT'
};

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
const headers = Object.keys(columnTypes);

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

// Función para formatear los valores según el tipo de columna
function formatValue(value, type) {
    if (value === null || value === undefined || value === '') {
        return 'NULL';
    }
    if (type === 'INT' || type === 'DOUBLE') {
        return value;
    }
    if (type.startsWith('VARCHAR')) {
        const escaped = String(value).replace(/'/g, "''");
        return `'${escaped}'`;
    }
    if (type === 'DATE') {
        const date = new Date(value);
        const formattedDate = isNaN(date.getTime()) ? 'NULL' : `'${date.toISOString().split('T')[0]}'`;
        return formattedDate;
    }
    // Por defecto, tratar como cadena
    const escaped = String(value).replace(/'/g, "''");
    return `'${escaped}'`;
}

// Generar el DML
let dml = '';
let batch = [];
jsonData.forEach((row, rowIndex) => {
    // Escapar y formatear los valores
    const values = headers.map(header => formatValue(row[header], columnTypes[header]));
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
