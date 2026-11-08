import { createApp } from "./app.ts";
import { config } from "./config.ts";

console.log("Config loaded:", {
  ...config,
  db: { ...config.db, password: "****" },
});

const _app = createApp();
const port = config.server.port;

_app.listen(port, () => {
  console.log(`wallet listening on :${port}`);
});
