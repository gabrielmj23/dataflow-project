import * as React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type NodeInfoButtonProps = {
  description: string;
  className?: string;
  label?: string;
};

export default function NodeInfoButton({
  description,
  className,
  label = "Información",
}: NodeInfoButtonProps) {
  const button = (
    <Button
      type="button"
      size="icon-node"
      variant="node"
      aria-label={label}
      className={cn(
        "bg-transparent shadow-none p-1 text-(--node-action-color)",
        className,
      )}
    >
      <span className="text-[12px] font-semibold leading-none">i</span>
    </Button>
  );
  const [open, setOpen] = React.useState(false);
  const openSource = React.useRef<"hover" | "click" | null>(null);
  const closeTimeout = React.useRef<number | null>(null);

  const clearCloseTimeout = () => {
    if (closeTimeout.current) {
      window.clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
  };

  const scheduleClose = (delay = 100) => {
    clearCloseTimeout();
    closeTimeout.current = window.setTimeout(() => {
      if (openSource.current === "hover") {
        setOpen(false);
        openSource.current = null;
      }
      closeTimeout.current = null;
    }, delay) as unknown as number;
  };

  React.useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      openSource.current = null;
    } else {
      if (openSource.current === null) openSource.current = "click";
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        asChild
        onPointerDown={(e) => e.preventDefault()}
        onPointerEnter={() => {
          clearCloseTimeout();
          setOpen(true);
          openSource.current = "hover";
        }}
        onPointerLeave={() => scheduleClose(100)}
        onClick={(e) => {
          clearCloseTimeout();
          if (openSource.current === "hover") {
            e.preventDefault();
            e.stopPropagation();
            openSource.current = "click";
            setOpen(true);
          } else {
            openSource.current = "click";
          }
        }}
      >
        {button}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={6}
        onPointerEnter={() => {
          clearCloseTimeout();
          setOpen(true);
        }}
        onPointerLeave={() => scheduleClose(100)}
        className={cn(
          "bg-background text-foreground border border-slate-300 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-sm text-balance",
        )}
      >
        {description}
      </PopoverContent>
    </Popover>
  );
}
