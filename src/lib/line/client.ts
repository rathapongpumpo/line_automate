import crypto from "node:crypto";

export type LineTextMessage = { type: "text"; text: string };
export type LineProfile = { displayName: string; userId: string; pictureUrl?: string; language?: string };

export class LineApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly retryAfterSeconds: number | null,
    public readonly requestId: string | null,
  ) { super(message); }
}

const API = "https://api.line.me";
const DATA_API = "https://api-data.line.me";

function token() {
  const value = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!value) throw new LineApiError("LINE access token is not configured", 503, "LINE_NOT_CONFIGURED", true, null, null);
  return value;
}

async function lineFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token()}`, ...init.headers },
  });
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const status = response.status;
    throw new LineApiError(
      `LINE API request failed (${status})`,
      status,
      `LINE_HTTP_${status}`,
      status === 429 || status >= 500,
      retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null,
      response.headers.get("x-line-request-id"),
    );
  }
  return response;
}

async function send(endpoint: string, body: Record<string, unknown>, retryKey?: string) {
  const response = await lineFetch(`${API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(retryKey ? { "X-Line-Retry-Key": retryKey } : {}) },
    body: JSON.stringify(body),
  });
  return { requestId: response.headers.get("x-line-request-id") };
}

export const lineClient = {
  replyMessage(replyToken: string, messages: LineTextMessage[]) {
    return send("/v2/bot/message/reply", { replyToken, messages });
  },
  pushMessage(lineUserId: string, messages: LineTextMessage[], retryKey: string) {
    return send("/v2/bot/message/push", { to: lineUserId, messages }, retryKey);
  },
  async getProfile(lineUserId: string): Promise<LineProfile> {
    const response = await lineFetch(`${API}/v2/bot/profile/${encodeURIComponent(lineUserId)}`);
    return await response.json() as LineProfile;
  },
  async getMessageContent(messageId: string) {
    return lineFetch(`${DATA_API}/v2/bot/message/${encodeURIComponent(messageId)}/content`);
  },
  async getBotInfo() {
    const response = await lineFetch(`${API}/v2/bot/info`);
    const body = await response.json() as { displayName?: string; basicId?: string };
    return { displayName: body.displayName ?? "LINE OA", basicId: body.basicId ?? null };
  },
};

export function classifyLineError(error: unknown) {
  if (error instanceof LineApiError) return error;
  if (error instanceof Error && error.name === "TimeoutError") return new LineApiError("LINE API timeout", 504, "LINE_TIMEOUT", true, null, null);
  return new LineApiError("LINE API unavailable", 503, "LINE_UNAVAILABLE", true, null, null);
}

export function createLineRetryKey(seed: string) {
  const value = crypto.createHash("sha256").update(seed).digest("hex");
  const variant = (8 + (Number.parseInt(value[16], 16) % 4)).toString(16);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-${variant}${value.slice(17, 20)}-${value.slice(20, 32)}`;
}
