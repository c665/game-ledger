import { createApp } from "./app.ts";

const _app = createApp();
const port = Number(process.env.PORT ?? 3000);

_app.listen(port, () => {
	console.log(`wallet listening on :${port}`);
});
