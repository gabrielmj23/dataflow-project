import { nanoid } from "nanoid";

export function createNodeId(): string {
  return nanoid(16);
}
