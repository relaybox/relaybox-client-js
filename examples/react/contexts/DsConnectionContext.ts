import { createContext } from 'react';

interface ConnectionContextState {
  isConnected: boolean;
  connect: () => Promise<void>;
}

export const ConnectionContext = createContext<ConnectionContextState | undefined>(undefined);
