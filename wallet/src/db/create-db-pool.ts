import pg from "pg";
import { config } from "../config.ts";

// Return bigint (int8) columns as bigint instead of string
pg.types.setTypeParser(pg.types.builtins.INT8, BigInt);

export const createDbPool = () => {
  const { db } = config;

  return new pg.Pool({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
  });
};
