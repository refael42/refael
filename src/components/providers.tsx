"use client";
import { DirectionProvider } from "@radix-ui/react-direction";
import { TooltipProvider } from "@radix-ui/react-tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DirectionProvider dir="rtl">
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </DirectionProvider>
  );
}
