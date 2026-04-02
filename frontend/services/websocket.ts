/**
 * WebSocket service for Duelo real-time features.
 * Handles: chat, matchmaking, live game, notifications.
 * Auto-reconnects on disconnect.
 */

type WSMessage = {
  type: string;
  data?: any;
};

type MessageHandler = (msg: WSMessage) => void;

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

class DueloWebSocket {
  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private intentionalClose = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Connect to the WebSocket server.
   */
  async connect(userId: string) {
    if (this.ws && this.userId === userId) return; // Already connected
    this.disconnect(); // Clean up previous connection

    this.userId = userId;
    this.intentionalClose = false;
    this.reconnectDelay = 1000;

    const token = await AsyncStorage.getItem('duelo_token') ?? '';
    const wsUrl = API_URL.replace(/^http/, 'ws') + `/ws/${userId}?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.emit({ type: 'ws_connected' });

      // Keep-alive ping every 25s
      this.pingInterval = setInterval(() => {
        this.send({ action: 'ping' });
      }, 25000);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        this.emit(msg);
      } catch {}
    };

    this.ws.onclose = () => {
      this.cleanup();
      this.emit({ type: 'ws_disconnected' });
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect() {
    this.intentionalClose = true;
    this.cleanup();
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.userId = null;
  }

  /**
   * Send a JSON message to the server.
   */
  send(data: Record<string, any>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Subscribe to a specific message type.
   * Returns an unsubscribe function.
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  /**
   * Check if currently connected.
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  get currentUserId(): string | null {
    return this.userId;
  }

  private emit(msg: WSMessage) {
    // Notify specific type listeners
    this.listeners.get(msg.type)?.forEach((h) => h(msg));
    // Notify wildcard listeners
    this.listeners.get('*')?.forEach((h) => h(msg));
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.userId && !this.intentionalClose) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        const uid = this.userId;
        this.ws = null;
        this.connect(uid);
      }
    }, this.reconnectDelay);
  }
}

// Singleton
export const dueloWS = new DueloWebSocket();
