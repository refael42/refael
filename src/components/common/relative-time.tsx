"use client";
import { useEffect, useState } from "react";
import { fmtDateTime, fmtRelative } from "@/lib/i18n";

/** Relative timestamps tick on the client; the server renders the absolute time. */
export function RelativeTime({ value }: { value: string }) {
  const [text, setText] = useState(() => fmtDateTime(value));
  useEffect(() => {
    setText(fmtRelative(value));
    const id = setInterval(() => setText(fmtRelative(value)), 60_000);
    return () => clearInterval(id);
  }, [value]);
  return (
    <time dateTime={value} title={fmtDateTime(value)}>
      {text}
    </time>
  );
}
