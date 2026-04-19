import { describe, expect, it } from "vitest";

import { deserializeProgram } from "@/flow/serialization";
import { runFlowHeadless } from "@/test-utils/run-flow-headless";
import { programFixtures } from "@/tests/fixtures/program-fixtures";

function getWriteLogs(
  logs: Array<{ message: string; data?: unknown }>,
): string[] {
  return logs
    .filter((log) => log.message === "write")
    .map((log) => String(log.data ?? ""));
}

describe("program fixtures integration", () => {
  for (const fixture of programFixtures) {
    it(`executes fixture: ${fixture.name}`, async () => {
      const restored = deserializeProgram(fixture.program);

      if (typeof fixture.expectedEdgeCountAfterDeserialize === "number") {
        expect(restored.edges).toHaveLength(
          fixture.expectedEdgeCountAfterDeserialize,
        );
      }

      const result = await runFlowHeadless({
        nodes: restored.nodes,
        edges: restored.edges,
      });

      const writeLogs = getWriteLogs(result.logs);

      for (const expected of fixture.expectedWriteLogs ?? []) {
        expect(writeLogs).toContain(expected);
      }

      for (const forbidden of fixture.forbiddenWriteLogs ?? []) {
        expect(writeLogs).not.toContain(forbidden);
      }
    });
  }
});
