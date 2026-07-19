const path = require('path');

const migrations = {
  directory: path.join(__dirname, 'src', 'db', 'migrations')
};

const pool = {
  afterCreate: (conn, cb) => {
    conn.run('PRAGMA journal_mode = WAL;', (err) => {
      if (err) return cb(err, conn);
      conn.run('PRAGMA busy_timeout = 5000;', (err2) => {
        cb(err2, conn);
      });
    });
  }
};

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DB_PATH || path.join(__dirname, 'data', 'database.sqlite')
    },
    useNullAsDefault: true,
    migrations,
    pool,
    seeds: {
      directory: path.join(__dirname, 'src', 'db', 'seeds')
    }
  },
  test: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:'
    },
    useNullAsDefault: true,
    migrations
  },
  production: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DB_PATH || '/app/data/database.sqlite'
    },
    useNullAsDefault: true,
    migrations,
    pool
  }
};

