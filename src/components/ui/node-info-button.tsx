import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
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
      className={cn("bg-transparent shadow-none p-1 text-(--node-action-color)", className)}
    >
      <span className="text-[12px] font-semibold leading-none">i</span>
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
