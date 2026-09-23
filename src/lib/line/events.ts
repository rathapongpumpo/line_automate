import { z } from "zod";

const sourceSchema = z.object({
  type: z.enum(["user", "group", "room"]),
  userId: z.string().optional(),
  groupId: z.string().optional(),
  roomId: z.string().optional(),
});

const messageSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "image", "video", "audio", "file", "location", "sticker"]),
  text: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  title: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  packageId: z.string().optional(),
  stickerId: z.string().optional(),
}).passthrough();

const eventSchema = z.object({
  webhookEventId: z.string().min(1),
  type: z.enum(["follow", "unfollow", "message", "postback"]),
  timestamp: z.number(),
  mode: z.enum(["active", "standby"]).optional().default("active"),
  deliveryContext: z.object({ isRedelivery: z.boolean() }).optional(),
  source: sourceSchema,
  replyToken: z.string().optional(),
  message: messageSchema.optional(),
  postback: z.object({ data: z.string().max(300) }).optional(),
}).superRefine((event, ctx) => {
  if (event.type === "message" && !event.message) ctx.addIssue({ code: "custom", message: "message payload required" });
  if (event.source.type === "user" && !event.source.userId) ctx.addIssue({ code: "custom", message: "userId required" });
});

export type LineMessageType = "text" | "image" | "video" | "audio" | "file" | "location" | "sticker";
export type NormalizedLineEvent = {
  eventId: string;
  type: "follow" | "unfollow" | "message" | "postback";
  occurredAt: string;
  isRedelivery: boolean;
  mode: "active" | "standby";
  source: { type: "user" | "group" | "room"; userId?: string; groupId?: string; roomId?: string };
  message?: { id: string; type: LineMessageType; text?: string; metadata: Record<string, unknown> };
  postbackData?: string;
  replyToken?: string;
};

export function normalizeLineEvent(input: unknown): NormalizedLineEvent {
  const event = eventSchema.parse(input);
  const metadata = event.message ? Object.fromEntries(Object.entries(event.message).filter(([key]) => !["id", "type", "text"].includes(key))) : undefined;
  return {
    eventId: event.webhookEventId,
    type: event.type,
    occurredAt: new Date(event.timestamp).toISOString(),
    isRedelivery: event.deliveryContext?.isRedelivery ?? false,
    mode: event.mode,
    source: event.source,
    ...(event.message && { message: { id: event.message.id, type: event.message.type, ...(event.message.text && { text: event.message.text }), metadata: metadata ?? {} } }),
    ...(event.postback?.data && { postbackData: event.postback.data }),
    ...(event.replyToken && { replyToken: event.replyToken }),
  };
}

export const webhookPayloadSchema = z.object({ events: z.array(z.unknown()).max(100) });
