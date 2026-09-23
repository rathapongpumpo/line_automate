import type { ConversationStatus } from "@/lib/types";

export type ConversationAction = "TAKEOVER" | "RESUME" | "CLOSE";
const allowed: Record<ConversationAction, ConversationStatus[]> = {
  TAKEOVER: ["AUTO", "WAITING"],
  RESUME: ["ADMIN", "WAITING"],
  CLOSE: ["AUTO", "WAITING", "ADMIN"],
};
const target: Record<ConversationAction, ConversationStatus> = { TAKEOVER: "ADMIN", RESUME: "AUTO", CLOSE: "CLOSED" };

export function transitionTarget(from: ConversationStatus, action: ConversationAction) {
  if (!allowed[action].includes(from)) throw new Error(`INVALID_TRANSITION:${from}:${action}`);
  return target[action];
}
