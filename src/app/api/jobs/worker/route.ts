import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { processDueJobs } from "@/lib/jobs/worker";
function validSecret(value: string | null, expected: string | undefined) {
  if (!value || !expected) return false;
  const a = Buffer.from(value); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
}
async function runWorker() {
  return NextResponse.json({ results: await processDueJobs(10) });
}
export async function POST(request: Request) {
  if (!validSecret(bearer(request), process.env.INTERNAL_JOB_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runWorker();
}
export async function GET(request: Request) {
  if (!validSecret(bearer(request), process.env.CRON_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runWorker();
}
