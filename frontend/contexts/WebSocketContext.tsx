import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { dueloWS } from '../services/websocket';

type WebSocketContextType = {
  isConnected: boolean;
  unreadMessages: number;
  unreadNotifs: number;
  /** Send a message through the WebSocket */
  send: (data: Record<string, any>) => void;
  /** Subscribe to a message type. Returns unsubscribe function. */
  on: (type: string, handler: (msg: any) => void) => () => void;
  /** Decrement unread messages count (when user reads a conversation) */
  decrementUnread: (count?: number) => void;
  /** Reset unread notifications count */
  resetNotifCount: () => void;
};

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  unreadMessages: 0,
  unreadNotifs: 0,
  send: () => {},
  on: () => () => {},
  decrementUnread: () => {},
  resetNotifCount: () => {},
});

export function useWS() {
  return useContext(WebSocketContext);
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const userIdRef = useRef<string | null>(null);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize connection
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      if (userId && mounted) {
        userIdRef.current = userId;
        dueloWS.connect(userId);
        // Fetch initial unread counts via HTTP
        fetchUnreadCounts(userId);
      }
    };

    init();

    // Reconnect when app comes back to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userIdRef.current) {
        if (!dueloWS.isConnected) {
          dueloWS.connect(userIdRef.current);
        }
        fetchUnreadCounts(userIdRef.current);
      }
    });

    return () => {
      mounted = false;
      sub.remove();
      dueloWS.disconnect();
    };
  }, []);

  // Listen for connection state and incoming messages
  useEffect(() => {
    const unsubs = [
      dueloWS.on('ws_connected', () => setIsConnected(true)),
      dueloWS.on('ws_disconnected', () => setIsConnected(false)),
      // Increment unread when a new chat message arrives
      dueloWS.on('chat_message', () => {
        setUnreadMessages((prev) => prev + 1);
      }),
      // Increment unread when a notification arrives
      dueloWS.on('notification', () => {
        setUnreadNotifs((prev) => prev + 1);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const fetchUnreadCounts = (userId: string) => {
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => _doFetchUnreadCounts(userId), 500);
  };

  const _doFetchUnreadCounts = async (userId: string) => {
    try {
      const [msgRes, notifRes] = await Promise.all([
        fetch(`${API_URL}/api/chat/unread-count/${userId}`),
        fetch(`${API_URL}/api/notifications/${userId}/unread-count`),
      ]);
      const msgData = await msgRes.json();
      const notifData = await notifRes.json();
      setUnreadMessages(msgData.unread_count || 0);
      setUnreadNotifs(notifData.unread_count || 0);
    } catch {}
  };

  const send = useCallback((data: Record<string, any>) => {
    dueloWS.send(data);
  }, []);

  const on = useCallback((type: string, handler: (msg: any) => void) => {
    return dueloWS.on(type, handler);
  }, []);

  const decrementUnread = useCallback((count = 1) => {
    setUnreadMessages((prev) => Math.max(0, prev - count));
  }, []);

  const resetNotifCount = useCallback(() => {
    setUnreadNotifs(0);
  }, []);

  return (
    <WebSocketContext.Provider value={{
      isConnected, unreadMessages, unreadNotifs,
      send, on, decrementUnread, resetNotifCount,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}
