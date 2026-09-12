// Broadcast Channel for zero-latency cross-tab communication
const CHANNEL_NAME = '1xwinner_sync';

export interface SyncMessage {
  type: 
    | 'NEW_DEPOSIT'
    | 'NEW_WITHDRAW'
    | 'SETTINGS_UPDATED'
    | 'DEPOSIT_APPROVED'
    | 'DEPOSIT_REJECTED'
    | 'WITHDRAW_APPROVED'
    | 'WITHDRAW_REJECTED'
    | 'DIRECT_TOPUP'
    | 'SUPPORT_UPDATED'
    | 'USER_UPDATED'
    | 'USER_BANNED'
    | 'USER_UNBANNED'
    | 'FORCED_CRASH_UPDATED';
  data?: any;
  timestamp: number;
}

let channel: BroadcastChannel | null = null;

export function getSyncChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return null;
  }
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      console.warn('BroadcastChannel not supported or error:', e);
    }
  }
  return channel;
}

export function broadcastSync(type: SyncMessage['type'], data?: any) {
  const ch = getSyncChannel();
  if (ch) {
    try {
      ch.postMessage({
        type,
        data,
        timestamp: Date.now(),
      } as SyncMessage);
    } catch (e) {
      console.warn('BroadcastSync postMessage error:', e);
    }
  }
}

export function subscribeSync(callback: (msg: SyncMessage) => void): () => void {
  const ch = getSyncChannel();
  if (!ch) return () => {};

  const handler = (e: MessageEvent<SyncMessage>) => {
    if (e.data && e.data.type) {
      callback(e.data);
    }
  };

  ch.addEventListener('message', handler);
  return () => {
    ch.removeEventListener('message', handler);
  };
}
