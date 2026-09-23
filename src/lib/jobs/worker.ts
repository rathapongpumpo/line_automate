import { createNotification } from "@/lib/notification/service";
import { sql } from "@/lib/db";
import { LineApiError } from "@/lib/line/client";
import { processLineEvent, processMediaFetch, processOutboundMessage, processProfileSync } from "@/lib/line/processor";
import type { NormalizedLineEvent } from "@/lib/line/events";
import { claimDueJobs, claimJobByDedupeKey, completeJob, failJob } from "./repository";

function payload(job: Record<string, unknown>) { return job.payload as Record<string, unknown>; }
function safeError(error: unknown) {
  if (error instanceof LineApiError) return { code: error.code, message: error.message, retryable: error.retryable, retryAfterSeconds: error.retryAfterSeconds };
  const shaped = error as { code?: string; message?: string; retryable?: boolean };
  return { code: shaped.code ?? "JOB_FAILED", message: shaped.message ?? "Job processing failed", retryable: shaped.retryable ?? true };
}

async function runClaimedJob(job: Record<string, unknown>) {
  const id = Number(job.id);
  const data = payload(job);
  try {
    switch (String(job.job_type)) {
      case "LINE_EVENT":
        await processLineEvent(data.event as NormalizedLineEvent);
        await sql`UPDATE webhook_events SET processing_status='PROCESSED',processed_at=NOW(),attempt_count=attempt_count+1,last_error_code=NULL,last_error_message=NULL WHERE event_id=${String(data.eventId)}`;
        break;
      case "OUTBOUND_PUSH": await processOutboundMessage(Number(data.messageId)); break;
      case "PROFILE_SYNC": await processProfileSync(Number(data.customerId), String(data.lineUserId)); break;
      case "MEDIA_FETCH": await processMediaFetch(Number(data.messageId), String(data.lineMessageId), String(data.messageType)); break;
      default: throw Object.assign(new Error("Unknown job type"), { code: "UNKNOWN_JOB", retryable: false });
    }
    await completeJob(id);
    return { id, status: "COMPLETED" };
  } catch (error) {
    const normalized = safeError(error);
    const dead = await failJob(job, normalized);
    if (String(job.job_type) === "LINE_EVENT") await sql`UPDATE webhook_events SET processing_status=${dead ? "FAILED" : "RETRY"},attempt_count=attempt_count+1,next_attempt_at=NOW()+INTERVAL '1 minute',last_error_code=${normalized.code},last_error_message=${normalized.message.slice(0, 300)} WHERE event_id=${String(data.eventId)}`;
    if (dead) await createNotification({ type: "JOB_DEAD", title: "งานประมวลผลล้มเหลว", body: `${String(job.job_type)} เข้าสถานะ dead-letter`, dedupeKey: `job-dead:${id}`, referenceType: "job", referenceId: String(id) });
    return { id, status: dead ? "DEAD" : "RETRY" };
  }
}

export async function processJobByDedupeKey(dedupeKey: string) {
  const job = await claimJobByDedupeKey(dedupeKey);
  return job ? runClaimedJob(job) : null;
}

export async function processDueJobs(limit = 10) {
  const jobs = await claimDueJobs(limit);
  return Promise.all(jobs.map(runClaimedJob));
}
