require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leaflet_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection saat startup
pool.getConnection()
  .then(conn => {
    console.log('Database connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('Unexpected database error:', err);
    process.exit(-1);
  });

module.exports = {
  // Wrapper agar kompatibel dengan cara pakai lama: db.query(text, params)
  // mysql2 mengembalikan [rows, fields], kita wrap agar result.rows tersedia
  query: async (text, params) => {
    const [rows, fields] = await pool.execute(text, params || []);
    return { rows, fields };
  },
  pool,
};
