import type { Notification } from "@/lib/types";

type NotificationTarget = Pick<
  Notification,
  "conversationId" | "leadId" | "referenceId" | "referenceType"
>;

export function notificationHref(item: NotificationTarget) {
  if (item.referenceType === "lead") {
    const leadId = item.referenceId ?? item.leadId;
    if (leadId) return `/leads?lead=${leadId}`;
  }
  if (item.conversationId) return `/inbox?conversation=${item.conversationId}`;
  if (item.referenceType === "conversation" && item.referenceId) {
    return `/inbox?conversation=${item.referenceId}`;
  }
  return null;
}
