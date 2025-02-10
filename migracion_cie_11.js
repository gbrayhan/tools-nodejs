require('dotenv').config();

const mysql = require('mysql2/promise');
const { Client } = require('pg');

(async () => {
    // Configuración de conexión para MySQL/MariaDB (CIE 11)
    const mysqlConfig = {
        host: process.env.MIGRATION_MYSQL_HOST || 'mariadb-aceso',
        port: process.env.MIGRATION_MYSQL_PORT ? parseInt(process.env.MIGRATION_MYSQL_PORT, 10) : 3306,
        user: process.env.MIGRATION_MYSQL_USER || 'appuser',
        password: process.env.MIGRATION_MYSQL_PASSWORD || 'youShouldChangeThisPassword',
        database: process.env.MIGRATION_MYSQL_DATABASE || 'aceso_sistema',
    };

    // Configuración de conexión para PostgreSQL
    const pgConfig = {
        host: process.env.MIGRATION_DB_HOST || 'db-psql-aceso',
        port: process.env.MIGRATION_DB_PORT ? parseInt(process.env.MIGRATION_DB_PORT, 10) : 5432,
        user: process.env.MIGRATION_DB_USER || 'default_pg_user',
        password: process.env.MIGRATION_DB_PASSWORD || 'default_pg_password',
        database: process.env.MIGRATION_DB_NAME || 'default_pg_database',
        ssl: process.env.MIGRATION_DB_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
    };

    try {
        // Conectar a MySQL/MariaDB
        const mysqlConnection = await mysql.createConnection(mysqlConfig);
        console.log('Conectado a MySQL/MariaDB.');

        // Conectar a PostgreSQL
        const pgClient = new Client(pgConfig);
        await pgClient.connect();
        console.log('Conectado a PostgreSQL.');

        // Ejecutar consulta en MySQL para obtener los registros de la tabla de CIE 11
        // Se extraen los campos necesarios para la migración.
        const [rows] = await mysqlConnection.execute(
            'SELECT chapter_no, chapter_title, code, title FROM aceso_sistema.icd'
        );
        console.log(`Obtenidos ${rows.length} registros de MySQL/MariaDB.`);

        // Para cada registro, se inserta en PostgreSQL asignando '11' a la columna cie_version
        for (const row of rows) {
            const { chapter_no, chapter_title, code, title } = row;
            const insertQuery = `
                INSERT INTO icd_cies (cie_version, code, description, chapter_no, chapter_title)
                VALUES ($1, $2, $3, $4, $5)
            `;
            // Se asigna:
            // - '11' como versión
            // - code: de la columna code
            // - description: de la columna title (en español)
            // - chapter_no: de la columna chapter_no
            // - chapter_title: de la columna chapter_title
            const values = ['11', code, title, chapter_no, chapter_title];
            await pgClient.query(insertQuery, values);
        }
        console.log('Migración de CIE 11 completada exitosamente.');

        // Cerrar conexiones
        await mysqlConnection.end();
        await pgClient.end();
        console.log('Conexiones cerradas.');
    } catch (error) {
        console.error('Error durante la migración:', error);
    }
})();
