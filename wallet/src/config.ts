import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65535);

const env = z.object({
  DB_HOST: z.string().min(1).default("localhost"),
  DB_PORT: port.default(5433),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1).default("wallet"),
  PORT: port.default(3000),
  TRANSACTION_RETRY_ATTEMPTS: z.coerce.number().int().min(0).default(3),
});

const parsed = env.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
}

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  PORT,
  TRANSACTION_RETRY_ATTEMPTS,
} = parsed.data;

export const config = {
  db: {
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  },
  server: {
    port: PORT,
  },
  domain: {
    transactionRetryAttempts: TRANSACTION_RETRY_ATTEMPTS,
  },
};
