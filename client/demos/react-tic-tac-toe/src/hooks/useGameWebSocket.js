import { useEffect, useRef } from "react";

export function useGameWebSocket(sessionId, onEvent) {
  const wsRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const hostIP = import.meta.env.VITE_HOST_IP;
    const hostPort = import.meta.env.VITE_HOST_PORT;
    console.log(
      "protocol:",
      protocol,
      "hostIP:",
      hostIP,
      "hostPort:",
      hostPort
    );
    const wsUrl = `${protocol}://${hostIP}:${hostPort}/?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onEvent?.(data);
    };

    return () => {
      ws.close();
    };
  }, [sessionId, onEvent]);
}
