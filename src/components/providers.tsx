"use client";
import { DirectionProvider } from "@radix-ui/react-direction";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return (
    <DirectionProvider dir="rtl">
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </DirectionProvider>
  );
}
