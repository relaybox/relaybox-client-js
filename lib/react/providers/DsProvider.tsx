import { useState, useCallback, ReactNode } from 'react';
import { ds } from '../../../util/ds.util';
import { ConnectionContext } from '../contexts/DsConnectionContext';

interface Props {
  children?: ReactNode;
}

export function DsProvider({ children }: Props) {
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    if (!isConnected) {
      await ds.connect();
      setIsConnected(true);
    }
  }, [isConnected]);

  return (
    <ConnectionContext.Provider value={{ isConnected, connect }}>
      {children}
    </ConnectionContext.Provider>
  );
}
