import sql from "mssql";
import { env } from "../config/env.js";

const sqlConfig = {
  user: env.sql.user,
  password: env.sql.password,
  server: env.sql.server,
  port: env.sql.port,
  database: env.sql.database,
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(sqlConfig).connect();
  }

  return poolPromise;
}

async function runQuery(queryText, bind = {}) {
  const pool = await getPool();
  const request = pool.request();

  Object.entries(bind).forEach(([name, value]) => {
    request.input(name, value);
  });

  return request.query(queryText);
}

export async function queryMany(queryText, bind = {}) {
  const result = await runQuery(queryText, bind);
  return result.recordset ?? [];
}

export async function queryOne(queryText, bind = {}) {
  const rows = await queryMany(queryText, bind);
  return rows[0] ?? null;
}

export async function executeQuery(queryText, bind = {}) {
  return runQuery(queryText, bind);
}
