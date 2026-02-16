export type ControllerSnapshot = {
  id: string;
  name?: string;
};

export type SessionSnapshot = {
  sessionKey: string;
  runnerConnected: boolean;
  controllers: ControllerSnapshot[];
};

export type RestApiOptions = {
  getSessionsSnapshot: () => SessionSnapshot[];
  getSessionSnapshot: (sessionKey: string) => SessionSnapshot | undefined;
};

export type ServerConfig = {
  host: string;
  port: number;
  maxMessageBytes: number;
};
