import http from "node:http";

import { createRestApp } from "./rest/api";
import { getServerConfig } from "./common";
import {
  attachWebSocketHub,
  getSessionSnapshot,
  getSessionsSnapshot,
} from "./ws/ws-hub";

const config = getServerConfig();

const app = createRestApp({
  getSessionsSnapshot,
  getSessionSnapshot,
  maxJsonBodyBytes: config.maxJsonBodyBytes,
});

const server = http.createServer(app);

attachWebSocketHub(server, {
  maxPayloadBytes: config.maxMessageBytes,
});

server.listen(config.port, config.host, () => {
  console.log(`[ws-server] listening on http://${config.host}:${config.port}`);
  console.log(`[ws-server] ws endpoint: ws://${config.host}:${config.port}`);
});
