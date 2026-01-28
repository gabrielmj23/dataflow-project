import { createContext, useContext } from "react";

export type RemoteControllerInfo = {
  id: string;
  name?: string;
};

const RemoteControllersContext = createContext<RemoteControllerInfo[]>([]);

export function RemoteControllersProvider({
  controllers,
  children,
}: {
  controllers: RemoteControllerInfo[];
  children: React.ReactNode;
}) {
  return (
    <RemoteControllersContext.Provider value={controllers}>
      {children}
    </RemoteControllersContext.Provider>
  );
}

export function useRemoteControllers(): RemoteControllerInfo[] {
  return useContext(RemoteControllersContext);
}
