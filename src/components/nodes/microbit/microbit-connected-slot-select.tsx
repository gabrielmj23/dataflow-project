import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MicrobitSlotState } from "@/microbit/slot-manager";

type MicrobitConnectedSlotSelectProps = {
  id?: string;
  label?: string;
  selectedSlot: number | null;
  connectedDevices: MicrobitSlotState[];
  onSlotChange: (slot: number) => void;
  emptyMessage?: string;
};

function getSlotLabel(device: MicrobitSlotState): string {
  return `Micro:bit #${device.slot}`;
}

export function MicrobitConnectedSlotSelect({
  id,
  label = "Dispositivo micro:bit",
  selectedSlot,
  connectedDevices,
  onSlotChange,
  emptyMessage = 'No hay micro:bits conectadas. Presiona "Conectar" arriba a la derecha para agregarlas.',
}: MicrobitConnectedSlotSelectProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-gray-900"
      >
        {label}
      </label>
      <Select
        value={selectedSlot !== null ? String(selectedSlot) : undefined}
        onValueChange={(value) => {
          const slot = Number.parseInt(value, 10);
          if (Number.isFinite(slot)) {
            onSlotChange(slot);
          }
        }}
        disabled={connectedDevices.length === 0}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Selecciona una micro:bit conectada" />
        </SelectTrigger>
        <SelectContent>
          {connectedDevices.length === 0 ? (
            <SelectItem value="__none__" disabled>
              Sin micro:bits conectadas
            </SelectItem>
          ) : (
            connectedDevices.map((device) => (
              <SelectItem key={device.slot} value={String(device.slot)}>
                {getSlotLabel(device)}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {connectedDevices.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{emptyMessage}</p>
      ) : null}
    </div>
  );
}
