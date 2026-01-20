import type { ReactNode } from "react";
import { ClipboardCheck, Copy, MessageCircleMore } from "lucide-react";
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
  copySelection,
  pasteSelection,
}: {
  children: ReactNode;
  onContextMenu: (event: React.MouseEvent) => void;
  onAddComment: () => void;
  copySelection: () => void;
  pasteSelection: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="flex h-full w-full"
        onContextMenu={onContextMenu}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-neutral-800 text-white">
        <ContextMenuItem
          className="hover:bg-neutral-700! hover:text-white!"
          onSelect={() => {
            onAddComment();
          }}
        >
          <MessageCircleMore className="text-white hover:text-white!" /> Agregar
          comentario
        </ContextMenuItem>
        <ContextMenuItem
          className="hover:bg-neutral-700! hover:text-white!"
          onSelect={() => {
            copySelection();
          }}
        >
          <Copy className="text-white hover:text-white!" /> Copiar
        </ContextMenuItem>
        <ContextMenuItem
          className="hover:bg-neutral-700! hover:text-white!"
          onSelect={() => {
            pasteSelection();
          }}
        >
          <ClipboardCheck className="text-white hover:text-white!" /> Pegar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
