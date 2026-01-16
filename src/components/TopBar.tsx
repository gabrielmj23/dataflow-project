import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function TopBar({
  programName,
  onProgramNameChange,
}: {
  programName: string;
  onProgramNameChange: (value: string) => void;
}) {
  return (
    <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
      <SidebarTrigger />
      <div className="flex items-center">
        <Input
          value={programName}
          onChange={(e) => onProgramNameChange(e.currentTarget.value)}
          placeholder="Nombre del programa"
          className="w-40 text-sm bg-white"
        />
      </div>
    </div>
  );
}
