import { Settings } from "lucide-react";
import { Button } from "./button";

export default function NodeSettingsButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick} size="icon-node" variant="node">
      <Settings size={12} color="#eeeeee" />
    </Button>
  );
}
