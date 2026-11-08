const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

const port = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be a port number, got "${raw}"`);
  }
  return value;
};

export const config = {
  db: {
    host: process.env.DB_HOST || "localhost",
    port: port("DB_PORT", 5433),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    database: process.env.DB_NAME || "wallet",
  },
  server: {
    port: port("SERVER_PORT", 3000),
  },
};
