import { useEffect, useState } from "react";

const philippineTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function PhilippineClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const parts = Object.fromEntries(
    philippineTime.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const displayTime = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} PHT`;

  return <time dateTime={now.toISOString()}>{displayTime}</time>;
}

export default PhilippineClock;
