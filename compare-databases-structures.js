const mysql = require('mysql');
require('dotenv').config()


// mysqldump --skip-lock-tables  --routines --add-drop-table --disable-keys --extended-insert -u root -p --host=127.0.0.1 --port=3306 your_database > "your_database_dump_$(date +%Y%m%d).sql"


// Configuración de las conexiones a las bases de datos
const DATABASE_STR_CON_A = process.env.DATABASE_STR_CON_A;
const DATABASE_STR_CON_B = process.env.DATABASE_STR_CON_B;

// Conexiones simplificadas
const db1 = mysql.createConnection(DATABASE_STR_CON_A);
const db2 = mysql.createConnection(DATABASE_STR_CON_B);

// Objeto para almacenar los resultados y detalles
let summaryDetails = {
    missingTables: [],
    missingColumns: [],
    dataTypeDifferences: []
};

// Función para obtener la estructura de las tablas
function getTableStructure(connection, callback) {
    connection.query("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()", (error, results) => {
        if (error) return callback(error, null);
        const structure = results.reduce((acc, { TABLE_NAME, COLUMN_NAME, DATA_TYPE }) => {
            acc[TABLE_NAME] = acc[TABLE_NAME] || {};
            acc[TABLE_NAME][COLUMN_NAME] = DATA_TYPE;
            return acc;
        }, {});
        callback(null, structure);
    });
}

// Función para comparar las estructuras de las bases de datos
function compareStructures(struct1, struct2) {
    const allTables = new Set([...Object.keys(struct1), ...Object.keys(struct2)]);
    allTables.forEach(table => {
        if (!struct1[table]) {
            summaryDetails.missingTables.push(`Tabla faltante en DB1: ${table}`);
        } else if (!struct2[table]) {
            summaryDetails.missingTables.push(`Tabla faltante en DB2: ${table}`);
        } else {
            const allColumns = new Set([...Object.keys(struct1[table]), ...Object.keys(struct2[table])]);
            allColumns.forEach(column => {
                if (!struct1[table][column]) {
                    summaryDetails.missingColumns.push(`Columna faltante en DB1: ${column} (en tabla ${table})`);
                } else if (!struct2[table][column]) {
                    summaryDetails.missingColumns.push(`Columna faltante en DB2: ${column} (en tabla ${table})`);
                } else if (struct1[table][column] !== struct2[table][column]) {
                    summaryDetails.dataTypeDifferences.push(`Diferencia de tipo en ${table}.${column}: DB1 usa ${struct1[table][column]}, DB2 usa ${struct2[table][column]}`);
                }
            });
        }
    });
}

console.log('Comparando estructuras de bases de datos...');
// Ejecutar comparación
db1.connect(err => {
    if (err) throw err;
    db2.connect(err => {
        if (err) throw err;
        getTableStructure(db1, (err, struct1) => {
            if (err) throw err;
            getTableStructure(db2, (err, struct2) => {
                if (err) throw err;
                compareStructures(struct1, struct2);
                db1.end();
                db2.end();
                // Imprimir detalles y resúmenes al final de manera elegante
                console.log('Resumen de diferencias:');
                console.log('Tablas faltantes:\n' + summaryDetails.missingTables.join('\n'));
                console.log('Columnas faltantes:\n' + summaryDetails.missingColumns.join('\n'));
                console.log('Diferencias en tipos de datos:\n' + summaryDetails.dataTypeDifferences.join('\n'));
            });
        });
    });
});
