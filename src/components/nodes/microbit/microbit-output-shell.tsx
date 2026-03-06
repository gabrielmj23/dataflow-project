import type { ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { getNodeDescription } from "@/flow/node-palette";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
	getPortTypeMask,
	maskToVisualPortDataType,
} from "@/flow/port-data-type";

type MicrobitOutputShellProps = {
	nodeType: string;
	icon: ReactNode;
	label: string;
	subtitle?: string;
	/** Optional explicit target handle ids. Defaults to one input: in-1. */
	targetHandleIds?: string[];
	onConfigClick?: () => void;
	runtimeError?: string | null;
};

function offsets(count: number): string[] {
	const safeCount = Math.max(0, Math.floor(count));
	if (safeCount === 0) return [];
	if (safeCount === 1) return ["50%"];

	const start = 25;
	const end = 85;
	const step = (end - start) / (safeCount - 1);
	return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export function MicrobitOutputShell({
	nodeType,
	icon,
	label,
	subtitle,
	targetHandleIds,
	onConfigClick,
	runtimeError,
}: MicrobitOutputShellProps) {
	const ids = targetHandleIds && targetHandleIds.length > 0 ? targetHandleIds : ["in-1"];
	const targetOffsets = offsets(ids.length);

	const maskFor = (params: {
		handleType: "source" | "target";
		handleId: string | null | undefined;
	}) =>
		getPortTypeMask({
			nodeType,
			handleType: params.handleType,
			handleId: params.handleId ?? null,
		});

	return (
		<BaseNode
			runtimeError={runtimeError}
			infoDescription={getNodeDescription(nodeType) ?? undefined}
			onConfigClick={onConfigClick}
			className="relative flex h-18 w-56 flex-col items-center justify-center rounded-2xl border-sky-700 bg-sky-600 px-5 text-center text-white shadow-md"
		>
			<div className="flex flex-col items-center gap-0.5">
				<div className="text-xl font-bold leading-none">{icon}</div>
				<div className="text-sm leading-tight">{label}</div>
				{subtitle && (
					<div className="text-xs leading-tight text-white/85">{subtitle}</div>
				)}
			</div>

			{ids.map((handleId, index) => {
				const mask = maskFor({ handleType: "target", handleId });
				const dt = maskToVisualPortDataType(mask);
				return (
					<CustomTypedHandle
						key={`microbit-in-${handleId}`}
						type="target"
						position={Position.Left}
						id={handleId}
						style={{ top: targetOffsets[index] ?? "50%" }}
						dataType={dt}
						typeMask={mask}
						className="absolute -left-1 h-2 w-2 -translate-y-1/2"
						indicatorClassName="border-blue-700"
					/>
				);
			})}
		</BaseNode>
	);
}

