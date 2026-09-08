import { createApp } from "./app";
import { env } from "./config/env";

createApp().listen(env.port, () => {
  console.log(`API do BeautyConta em http://localhost:${env.port}`);
});
