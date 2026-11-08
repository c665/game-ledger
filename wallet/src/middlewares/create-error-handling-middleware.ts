import type { ErrorRequestHandler } from "express";
import { z } from "zod";

export const createErrorHandlingMiddleware = (): ErrorRequestHandler => {
  return (err, _req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: "invalid_request",
        issues: z.flattenError(err).fieldErrors,
      });
      return;
    }

    const status = err.status ?? err.statusCode;
    if (status >= 400 && status < 500) {
      res.status(status).json({ error: "invalid_request" });
      return;
    }

    const errorId = crypto.randomUUID();
    console.error(`Unhandled error (errorId: ${errorId})`, err);
    res.status(500).json({ error: "internal_error", errorId });
  };
};
