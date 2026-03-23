import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMicrobitSlotOptions,
  sanitizeMicrobitSlot,
} from "@/microbit/slot-utils";

type MicrobitSlotFieldProps = {
  slot: number;
  onSlotChange: (slot: number) => void;
};

export function MicrobitSlotField({
  slot,
  onSlotChange,
}: MicrobitSlotFieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-900">
        Dispositivo micro:bit
      </label>
      <Select
        value={String(slot)}
        onValueChange={(value) => {
          onSlotChange(sanitizeMicrobitSlot(Number.parseInt(value, 10)));
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecciona" />
        </SelectTrigger>
        <SelectContent>
          {getMicrobitSlotOptions().map((item) => (
            <SelectItem key={item} value={String(item)}>
              Microbit #{item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1 text-xs text-muted-foreground">
        Selecciona uno de los 8 dispositivos disponibles.
      </p>
    </div>
  );
}
