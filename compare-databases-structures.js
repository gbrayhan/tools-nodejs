const mysql = require('mysql');
const { exec } = require('child_process'); // Importar el módulo child_process
const { URL } = require('url'); // Usar la clase URL nativa de Node.js
require('dotenv').config();

// Configuración de las conexiones a las bases de datos
const DATABASE_STR_CON_A = process.env.DATABASE_STR_CON_A;
const DATABASE_STR_CON_B = process.env.DATABASE_STR_CON_B;

// Función para parsear la cadena de conexión
function parseConnectionString(connectionString) {
    try {
        const url = new URL(connectionString);
        const user = url.username;
        const password = url.password;
        const host = url.hostname || '127.0.0.1';
        const port = url.port || 3306; // Puerto por defecto
        const dbName = url.pathname.replace('/', ''); // Remover la barra inicial
        return { user, password, host, port, dbName };
    } catch (err) {
        console.error('Error al parsear la cadena de conexión:', err.message);
        process.exit(1);
    }
}

// Parsear las cadenas de conexión
const dbConfigA = parseConnectionString(DATABASE_STR_CON_A);
const dbConfigB = parseConnectionString(DATABASE_STR_CON_B);

// Crear conexiones
const db1 = mysql.createConnection({
    host: dbConfigA.host,
    user: dbConfigA.user,
    password: dbConfigA.password,
    database: dbConfigA.dbName,
    port: dbConfigA.port
});

const db2 = mysql.createConnection({
    host: dbConfigB.host,
    user: dbConfigB.user,
    password: dbConfigB.password,
    database: dbConfigB.dbName,
    port: dbConfigB.port
});

// Objeto para almacenar los resultados y detalles
let summaryDetails = {
    missingTables: [],
    missingColumns: [],
    dataTypeDifferences: []
};

// Función para obtener la estructura de las tablas
function getTableStructure(connection, callback) {
    connection.query("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ?", [connection.config.database], (error, results) => {
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

// Función para exportar el DDL de una base de datos usando mysqldump
function exportDDL(config, outputFile, callback) {
    // Reemplazar 'localhost' por '127.0.0.1' para forzar conexión TCP
    const host = config.host === 'localhost' ? '127.0.0.1' : config.host;
    const passwordOption = config.password ? `--password=${config.password}` : '';
    // Añadir la opción --column-statistics=0 para evitar el error
    const dumpCommand = `mysqldump --no-data --routines --triggers --add-drop-table --disable-keys --column-statistics=0 --host=${host} --port=${config.port} --user=${config.user} ${passwordOption} ${config.dbName} > "${outputFile}"`;

    console.log(`Ejecutando comando: ${dumpCommand}`);

    exec(dumpCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error al exportar DDL de ${config.dbName}:`, error.message);
            return callback(error);
        }
        if (stderr && stderr.trim() !== '') {
            console.warn(`stderr al exportar DDL de ${config.dbName}:`, stderr);
            // No retornar error aquí ya que mysqldump puede enviar advertencias en stderr
        }
        console.log(`DDL de ${config.dbName} exportado exitosamente a ${outputFile}`);
        callback(null);
    });
}

console.log('Comparando estructuras de bases de datos...');

// Ejecutar comparación
db1.connect(err => {
    if (err) {
        console.error('Error al conectar a DB1:', err.message);
        process.exit(1);
    }
    db2.connect(err => {
        if (err) {
            console.error('Error al conectar a DB2:', err.message);
            process.exit(1);
        }
        getTableStructure(db1, (err, struct1) => {
            if (err) {
                console.error('Error al obtener la estructura de DB1:', err.message);
                process.exit(1);
            }
            getTableStructure(db2, (err, struct2) => {
                if (err) {
                    console.error('Error al obtener la estructura de DB2:', err.message);
                    process.exit(1);
                }
                compareStructures(struct1, struct2);
                db1.end();
                db2.end();

                // Imprimir detalles y resúmenes al final de manera elegante
                console.log('Resumen de diferencias:');
                console.log('Tablas faltantes:\n' + (summaryDetails.missingTables.length > 0 ? summaryDetails.missingTables.join('\n') : 'Ninguna'));
                console.log('Columnas faltantes:\n' + (summaryDetails.missingColumns.length > 0 ? summaryDetails.missingColumns.join('\n') : 'Ninguna'));
                console.log('Diferencias en tipos de datos:\n' + (summaryDetails.dataTypeDifferences.length > 0 ? summaryDetails.dataTypeDifferences.join('\n') : 'Ninguna'));

                // Formatear la fecha actual para los nombres de archivo
                const fecha = new Date().toISOString().slice(0,10).replace(/-/g, '');

                // Definir los nombres de los archivos de salida
                const outputFileDB1 = `docs/compare-database/ddl_${dbConfigA.dbName}_${fecha}.sql`;
                const outputFileDB2 = `docs/compare-database/ddl_${dbConfigB.dbName}_${fecha}.sql`;

                // Exportar DDL de ambas bases de datos
                exportDDL(dbConfigA, outputFileDB1, (err) => {
                    if (err) {
                        console.error(`Fallo al exportar DDL de ${dbConfigA.dbName}`);
                    } else {
                        exportDDL(dbConfigB, outputFileDB2, (err) => {
                            if (err) {
                                console.error(`Fallo al exportar DDL de ${dbConfigB.dbName}`);
                            } else {
                                console.log('Exportación de DDL completada para ambas bases de datos.');
                            }
                        });
                    }
                });
            });
        });
    });
});
