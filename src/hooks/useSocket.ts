import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useStore } from '@/store/useStore';
import type { Winner, Danmaku } from '../../shared/types';

interface DrawCompleteEvent {
  roundId: string;
  winners: Winner[];
}

interface DrawRedrawEvent {
  roundId: string;
  replacedWinnerId: string;
  newWinners: Winner[];
}

interface RoundUpdateEvent {
  roundId: string;
  remaining: number;
}

export function useSocket(activityId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const { addWinner, removeWinner, addDanmaku, approveDanmaku, setDrawState } = useStore();

  const connect = useCallback(() => {
    if (!activityId) return;

    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('join:activity', activityId);
    });

    socket.on('draw:start', () => {
      setDrawState({ isDrawing: true });
    });

    socket.on('draw:complete', (data: DrawCompleteEvent) => {
      setDrawState({ isDrawing: false });
      data.winners.forEach(winner => {
        addWinner(winner);
      });
    });

    socket.on('draw:redraw', (data: DrawRedrawEvent) => {
      removeWinner(data.replacedWinnerId);
      data.newWinners.forEach(winner => {
        addWinner(winner);
      });
    });

    socket.on('draw:update', (data: { number: string }) => {
      setDrawState({ currentNumber: data.number });
    });

    socket.on('round:update', (data: RoundUpdateEvent) => {
      console.log('Round update:', data);
    });

    socket.on('danmaku:new', (data: Danmaku) => {
      addDanmaku(data);
    });

    socket.on('danmaku:approved', (data: Danmaku) => {
      approveDanmaku(data.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [activityId, addWinner, removeWinner, addDanmaku, approveDanmaku, setDrawState]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (cleanup) cleanup();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return { socket: socketRef.current, emit };
}
