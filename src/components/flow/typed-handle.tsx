import { Handle, type HandleProps } from "@xyflow/react";

import { getHandleTypeClasses, type PortDataType } from "@/flow/port-data-type";
import { cn } from "@/lib/utils";

export type TypedHandleProps = Omit<HandleProps, "className"> & {
  className?: string;
  dataType?: PortDataType;
};

export function TypedHandle({
  dataType = "any",
  type = "source",
  className,
  ...props
}: TypedHandleProps) {
  return (
    <Handle
      type={type}
      className={cn(getHandleTypeClasses({ dataType, handleType: type }), className)}
      data-port-type={dataType}
      {...props}
    />
  );
}
