import { useState, useEffect } from "react";
import { Badge } from "@chakra-ui/react";

export function LiveTimer({ getLiveTimer, gameActive }) {
  const [liveTime, setLiveTime] = useState(null);

  useEffect(() => {
    if (!gameActive) {
      setLiveTime(null);
      return;
    }

    const updateTimer = () => {
      const time = getLiveTimer();
      setLiveTime(time);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [getLiveTimer, gameActive]);

  if (liveTime === null) return null;

  return (
    <Badge 
      colorScheme={liveTime <= 10 ? "red" : liveTime <= 20 ? "yellow" : "green"}
      variant="solid"
    >
      {liveTime}s
    </Badge>
  );
}