import { useEffect, useRef } from "react";

export function useGameWebSocket(sessionId, onEvent) {
  const wsRef = useRef(null);
  const onEventRef = useRef(onEvent);

  // Always keep the latest onEvent in the ref
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    // console.log(
    //   `[useGameWebSocket] useEffect triggered. sessionId: ${sessionId}`
    // );
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const hostIP = import.meta.env.VITE_HOST_IP;
    const hostPort = import.meta.env.VITE_HOST_PORT;
    const wsUrl = `${protocol}://${hostIP}:${hostPort}/?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // console.log(
      //   `[useGameWebSocket] WebSocket opened for session: ${sessionId}`
      // );
    };
    ws.onclose = (event) => {
      // console.log(
      //   `[useGameWebSocket] WebSocket closed for session: ${sessionId}`,
      //   event
      // );
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // console.log(`[useGameWebSocket] Received WebSocket message:`, data);
      // console.log(`[useGameWebSocket] Message type: ${data.type}`);
      // console.log(`[useGameWebSocket] Session ID: ${sessionId}`);
      onEventRef.current?.(data);
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);
}
