import { createContext } from 'react';

// CONTEXT EXAMPLE

interface ConnectionContextState {
  isConnected: boolean;
  connect: () => Promise<void>;
}

export const ConnectionContext = createContext<ConnectionContextState | undefined>(undefined);
