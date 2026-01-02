import { useEffect } from "react";

export type ConnectionErrorTooltipProps = {
  open: boolean;
  message: string;
  x: number;
  y: number;
  onClose?: () => void;
  timeoutMs?: number;
};

export function ConnectionErrorTooltip({
  open,
  message,
  x,
  y,
  onClose,
  timeoutMs = 1400,
}: ConnectionErrorTooltipProps) {
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => onClose?.(), timeoutMs);
    return () => window.clearTimeout(id);
  }, [open, onClose, timeoutMs]);

  if (!open) return null;

  const left = Math.min(Math.max(8, x + 12), window.innerWidth - 320);
  const top = Math.min(Math.max(8, y + 12), window.innerHeight - 80);

  return (
    <div
      className="fixed z-50 max-w-xs rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      style={{ left, top }}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
