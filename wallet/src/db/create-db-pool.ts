import pg from "pg";
import { config } from "../config.ts";

export const createDbPool = () => {
  const types = new pg.TypeOverrides();
  types.setTypeParser(pg.types.builtins.INT8, BigInt);

  const { db } = config;

  const pool = new pg.Pool({
    ...db,
    types,
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });

  return pool;
};
