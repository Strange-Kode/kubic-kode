import { useEffect, useRef } from "react";

export function useGameWebSocket(sessionId, participantId, onEvent) {
  const wsRef = useRef(null);
  const onEventRef = useRef(onEvent);

  // Always keep the latest onEvent in the ref
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!sessionId || !participantId) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const hostIP = import.meta.env.VITE_HOST_IP;
    const hostPort = import.meta.env.VITE_HOST_PORT;
    const wsUrl = `${protocol}://${hostIP}:${hostPort}/?sessionId=${sessionId}&participantId=${participantId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onEventRef.current?.(data);
    };

    return () => {
      ws.close();
    };
  }, [sessionId, participantId]);
}
