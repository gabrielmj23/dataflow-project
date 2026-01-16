import type { ReactNode } from "react";
import { MessageCircleMore } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function CanvasContextMenu({
  children,
  onContextMenu,
  onAddComment,
}: {
  children: ReactNode;
  onContextMenu: (event: React.MouseEvent) => void;
  onAddComment: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-full w-full" onContextMenu={onContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-neutral-800 text-white">
        <ContextMenuItem
          className="hover:bg-neutral-700! hover:text-white!"
          onSelect={(e: Event) => {
            e?.preventDefault?.();
            onAddComment();
          }}
        >
          <MessageCircleMore className="text-white hover:text-white!" />{" "}
          Agregar comentario
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
