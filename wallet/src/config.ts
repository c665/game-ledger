import { z } from "zod";

const int = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, "must be a whole number")
    .transform(Number)
    .pipe(z.number().min(min).max(max));

const port = int(1, 65535);

const env = z.object({
  DB_HOST: z.string().default("localhost"),
  DB_PORT: port.default(5433),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().default("wallet"),
  PORT: port.default(3000),
  TRANSACTION_RETRY_ATTEMPTS: int(0, 10).default(3),
});

const setVariables = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== ""),
);

const parsed = env.safeParse(setVariables);

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
