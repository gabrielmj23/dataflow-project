import http from "node:http";

import { createRestApp } from "./rest-api.ts";
import { getServerConfig } from "./common.ts";
import {
  attachWebSocketHub,
  getSessionSnapshot,
  getSessionsSnapshot,
} from "./ws-hub.ts";

const config = getServerConfig();

const app = createRestApp({
  getSessionsSnapshot,
  getSessionSnapshot,
});

const server = http.createServer(app);

attachWebSocketHub(server, {
  maxPayloadBytes: config.maxMessageBytes,
});

server.listen(config.port, config.host, () => {
  console.log(`[ws-server] listening on http://${config.host}:${config.port}`);
  console.log(`[ws-server] ws endpoint: ws://${config.host}:${config.port}`);
});
