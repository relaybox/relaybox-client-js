import { useEffect, useState } from 'react';
import { ds } from '../../../util/ds.util';
import { Room } from '../../room';
import { useConnection } from './useConnection';

export function useRoom(roomId: string): Room | null {
  const { connect } = useConnection();
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    let activeRoom: Room | null = null;

    (async () => {
      try {
        await connect();
        activeRoom = await ds.join(roomId);
        setRoom(activeRoom);
      } catch (err) {
        console.error('Failed to join room:', roomId, err);
        setRoom(null);
      }
    })();

    return () => {
      if (activeRoom) {
        activeRoom.leave();
        console.log(`Leaving room on component unmount: ${roomId}`);
      }
    };
  }, [roomId]);

  return room;
}
