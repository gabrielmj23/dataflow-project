import { Unplug } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type NodeConnectionButtonProps = {
  onClick: () => void;
  className?: string;
  label?: string;
};

export default function NodeConnectionButton({
  onClick,
  className,
  label = "Conexión remota",
}: NodeConnectionButtonProps) {
  const button = (
    <Button
      onClick={onClick}
      size="icon-node"
      variant="node"
      aria-label={label}
      className={cn(
        "bg-transparent shadow-none p-1 text-(--node-action-color)",
        className,
      )}
    >
      <Unplug className="size-3" />
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
