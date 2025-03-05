require('dotenv').config();

const mysql = require('mysql2/promise');
const { Client } = require('pg');

(async () => {
    // Configuración de conexión para MySQL/MariaDB
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
        // Conexión a MySQL/MariaDB
        const mysqlConnection = await mysql.createConnection(mysqlConfig);
        console.log('Conectado a MySQL/MariaDB.');

        // Conexión a PostgreSQL
        const pgClient = new Client(pgConfig);
        await pgClient.connect();
        console.log('Conectado a PostgreSQL.');

        // Consultar todos los registros de la tabla medicines en MySQL
        const [rows] = await mysqlConnection.execute('SELECT * FROM medicines');
        console.log(`Obtenidos ${rows.length} registros de MySQL/MariaDB.`);

        // Recorrer cada registro y migrarlo a PostgreSQL
        for (const row of rows) {
            const {
                id,
                ean_code,
                description,
                laboratory,
                iva,
                sat_key,
                created_at,
                updated_at,
                pmp,
                sale_price,
                discount_porcentaje,
                red_fria,
                controlado,
                is_deleted,
            } = row;

            // Convertir campos numéricos a booleanos según convención (0 = false, 1 = true)
            const cold_chain = red_fria === 1 ? true : false;
            const is_controlled = controlado === 1 ? true : false;
            const is_deleted_bool = is_deleted === 1 ? true : false;

            // Preparar la consulta de inserción en PostgreSQL
            // Se mapean los campos:
            //   pmp                   -> msrp
            //   discount_porcentaje   -> discount_percentage
            //   red_fria              -> cold_chain
            //   controlado            -> is_controlled
            const insertQuery = `
        INSERT INTO public.medicines (
          id,
          ean_code,
          description,
          laboratory,
          iva,
          sat_key,
          created_at,
          updated_at,
          msrp,
          sale_price,
          discount_percentage,
          cold_chain,
          is_controlled,
          is_deleted
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;
            const values = [
                id,
                ean_code,
                description,
                laboratory,
                iva,
                sat_key,
                created_at,
                updated_at,
                pmp,
                sale_price,
                discount_porcentaje,
                cold_chain,
                is_controlled,
                is_deleted_bool,
            ];

            await pgClient.query(insertQuery, values);
        }
        console.log('Migración completada exitosamente.');

        // Cerrar conexiones
        await mysqlConnection.end();
        await pgClient.end();
        console.log('Conexiones cerradas.');
    } catch (error) {
        console.error('Error durante la migración:', error);
    }
})();
