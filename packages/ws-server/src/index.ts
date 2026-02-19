import http from "node:http";

import { createRestApp } from "./rest/api.js";
import { getServerConfig } from "./common.js";
import {
  attachWebSocketHub,
  getSessionSnapshot,
  getSessionsSnapshot,
} from "./ws/ws-hub.js";

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
