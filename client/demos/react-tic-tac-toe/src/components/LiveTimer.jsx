import { useState, useEffect } from "react";
import { Badge } from "@chakra-ui/react";

export function LiveTimer({ inactivityTimer, gameActive }) {
  const [liveTime, setLiveTime] = useState(inactivityTimer);

  // Update local timer when inactivityTimer changes (from WebSocket events)
  useEffect(() => {
    setLiveTime(inactivityTimer);
  }, [inactivityTimer]);

  // Interpolate timer locally every second for smooth countdown
  useEffect(() => {
    if (!gameActive || inactivityTimer === null) {
      setLiveTime(null);
      return;
    }

    const interval = setInterval(() => {
      const KubicKode = window.KubicKode;
      if (KubicKode) {
        const interpolated = KubicKode.inactivity.getLiveTimer();
        setLiveTime(interpolated);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameActive]); // Only depend on gameActive, not inactivityTimer

  // Don't show timer if game is not active or timer is null
  if (!gameActive || liveTime === null) {
    return null;
  }

  return (
    <Badge
      colorScheme={liveTime <= 10 ? "red" : liveTime <= 20 ? "yellow" : "green"}
      variant="solid"
    >
      {liveTime}s
    </Badge>
  );
}