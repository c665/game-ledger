import pg from "pg";
import { config } from "../config.ts";

export const createDbPool = () => {
  const types = new pg.TypeOverrides();
  types.setTypeParser(pg.types.builtins.INT8, BigInt);

  const { db } = config;

  return new pg.Pool({
    ...db,
    types,
  });
};
