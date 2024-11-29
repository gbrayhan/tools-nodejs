const fs = require('fs');
const path = require('path');

// Ruta al archivo JSON
const jsonFilePath = path.join(__dirname, 'docs/icd/categoriesICDArray.json');

// Ruta al archivo SQL de salida
const sqlFilePath = path.join(__dirname, 'docs/icd/insert.sql');

// Nombre de la tabla en MySQL
const tableName = 'icd';

// Leer y parsear el archivo JSON
let jsonData;
try {
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    jsonData = JSON.parse(fileContent);
} catch (error) {
    console.error('Error leyendo o parseando el archivo JSON:', error);
    process.exit(1);
}

// Función para escapar caracteres especiales en SQL
function escapeSQL(value) {
    if (typeof value === 'string') {
        // Reemplazar comillas simples por dos comillas simples para escapar
        return `'${value.replace(/'/g, "''")}'`;
    } else if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
    } else if (value === null || value === undefined || value === '') {
        return 'NULL';
    } else {
        return value;
    }
}

// Mapeo de claves JSON a columnas de la tabla
const keyToColumnMap = {
    "ChapterNo": "chapter_no",
    "ChapterTitleEN": "chapter_title_en",
    "ChapterTitle": "chapter_title",
    "BlockId": "block_id",
    "BlockTitleEN": "block_title_en",
    "BlockTitle": "block_title",
    "Code": "code",
    "TitleEN": "title_en",
    "Title": "title",
    "ClassKind": "class_kind",
    "DepthInKind": "depth_in_kind",
    "IsResidual": "is_residual",
    "BrowserLink": "browser_link",
    "isLeaf": "is_leaf",
    "PrimaryTabulation": "primary_tabulation",
    "Grouping1": "grouping1",
    "Grouping2": "grouping2",
    "Grouping3": "grouping3",
    "Grouping4": "grouping4",
    "Grouping5": "grouping5",
    "Version": "version"
};

// Extraer los nombres de las columnas en el orden especificado
const columns = Object.values(keyToColumnMap);

// Iniciar la sentencia INSERT
let insertStatement = `INSERT INTO ${tableName} (\n    ${columns.join(', ')}\n) VALUES\n`;

// Construir los valores
const values = jsonData.map((record) => {
    const recordValues = columns.map((col) => {
        // Encontrar la clave JSON correspondiente
        const jsonKey = Object.keys(keyToColumnMap).find(key => keyToColumnMap[key] === col);
        let value = record[jsonKey];

        // Procesar según el tipo de columna
        switch (col) {
            case 'depth_in_kind':
                // Convertir a entero
                value = parseInt(value, 10);
                return isNaN(value) ? 'NULL' : value;
            case 'is_residual':
            case 'is_leaf':
            case 'primary_tabulation':
                // Convertir "True"/"False" a booleano
                if (typeof value === 'string') {
                    value = value.toLowerCase() === 'true';
                } else {
                    value = Boolean(value);
                }
                return escapeSQL(value);
            default:
                // Manejar NULLs y escapar cadenas
                return escapeSQL(value);
        }
    });
    return `(${recordValues.join(', ')})`;
}).join(',\n');

// Completar la sentencia INSERT
insertStatement += `${values};`;

// Escribir la sentencia SQL en un archivo
try {
    fs.writeFileSync(sqlFilePath, insertStatement, 'utf8');
    console.log(`La sentencia SQL ha sido guardada en ${sqlFilePath}`);
} catch (error) {
    console.error('Error escribiendo el archivo SQL:', error);
    process.exit(1);
}
