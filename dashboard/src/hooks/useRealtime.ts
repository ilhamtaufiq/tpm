import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WS_BASE_URL, getToken } from '../api/client';

// Contract mirrors frontend/services/realtime.ts: ?token=, types realtime.connected/error/event.
export function useRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      const token = getToken();
      if (!token) return;
      socket = new WebSocket(`${WS_BASE_URL}/realtime/ws?token=${encodeURIComponent(token)}`);
      socket.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as { type?: string; scope?: string; event?: string };
          if (payload.type === 'realtime.event' || payload.event) {
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            queryClient.invalidateQueries({ queryKey: ['recent_activity'] });
            if (payload.scope === 'finance' || !payload.scope) {
              queryClient.invalidateQueries({ queryKey: ['laba_rugi'] });
              queryClient.invalidateQueries({ queryKey: ['neraca'] });
            }
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      socket.onclose = (ev) => {
        if (cancelled || ev.code === 4401) return;
        attempt += 1;
        timer.current = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt));
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      socket?.close();
    };
  }, [enabled, queryClient]);
}
