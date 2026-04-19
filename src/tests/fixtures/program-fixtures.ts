import arithmeticSumFixture from "./programs/arithmetic-sum.fixture.json";
import controlDesvioFixture from "./programs/control-desvio.fixture.json";
import invalidTypeFilterFixture from "./programs/invalid-type-filter.fixture.json";
import textConcatFixture from "./programs/text-concat.fixture.json";

import type { SerializedProgramV1 } from "@/flow/serialization";

export type ProgramFixture = {
  name: string;
  program: SerializedProgramV1;
  expectedWriteLogs?: string[];
  forbiddenWriteLogs?: string[];
  expectedEdgeCountAfterDeserialize?: number;
};

export const programFixtures: ProgramFixture[] = [
  {
    name: "arithmetic-sum",
    program: arithmeticSumFixture as SerializedProgramV1,
    expectedWriteLogs: ["res=5"],
    expectedEdgeCountAfterDeserialize: 3,
  },
  {
    name: "text-concat",
    program: textConcatFixture as SerializedProgramV1,
    expectedWriteLogs: ["txt=hola mundo"],
    expectedEdgeCountAfterDeserialize: 3,
  },
  {
    name: "control-desvio",
    program: controlDesvioFixture as SerializedProgramV1,
    expectedWriteLogs: ["B=token"],
    forbiddenWriteLogs: ["A=token"],
    expectedEdgeCountAfterDeserialize: 4,
  },
  {
    name: "invalid-type-filter",
    program: invalidTypeFilterFixture as SerializedProgramV1,
    expectedWriteLogs: [],
    expectedEdgeCountAfterDeserialize: 0,
  },
];
