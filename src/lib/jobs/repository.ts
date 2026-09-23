import { sql } from "@/lib/db";
import { calculateBackoffMs } from "./retry";

export type JobType = "LINE_EVENT" | "OUTBOUND_PUSH" | "PROFILE_SYNC" | "MEDIA_FETCH";

export async function enqueueJob(type: JobType, dedupeKey: string, payload: Record<string, unknown>, maxAttempts = 8) {
  await sql`INSERT INTO jobs(job_type,dedupe_key,payload,max_attempts) VALUES(${type},${dedupeKey},${JSON.stringify(payload)}::jsonb,${maxAttempts}) ON CONFLICT(dedupe_key) DO NOTHING`;
}

export async function claimJobByDedupeKey(dedupeKey: string) {
  const rows = await sql`
    UPDATE jobs SET status='PROCESSING',locked_at=NOW(),attempt_count=attempt_count+1,updated_at=NOW()
    WHERE dedupe_key=${dedupeKey} AND ((status IN ('PENDING','RETRY') AND next_attempt_at<=NOW()) OR (status='PROCESSING' AND locked_at<NOW()-INTERVAL '5 minutes'))
    RETURNING *`;
  return rows[0] as Record<string, unknown> | undefined;
}

export async function claimDueJobs(limit = 10) {
  const rows = await sql`
    UPDATE jobs SET status='PROCESSING',locked_at=NOW(),attempt_count=attempt_count+1,updated_at=NOW()
    WHERE id IN (SELECT id FROM jobs WHERE (status IN ('PENDING','RETRY') AND next_attempt_at<=NOW()) OR (status='PROCESSING' AND locked_at<NOW()-INTERVAL '5 minutes') ORDER BY next_attempt_at LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING *`;
  return rows as Record<string, unknown>[];
}

export async function completeJob(id: number) {
  await sql`UPDATE jobs SET status='COMPLETED',completed_at=NOW(),locked_at=NULL,updated_at=NOW(),last_error_code=NULL,last_error_message=NULL WHERE id=${id}`;
}

export async function failJob(job: Record<string, unknown>, error: { code: string; message: string; retryable: boolean; retryAfterSeconds?: number | null }) {
  const id = Number(job.id);
  const attempts = Number(job.attempt_count);
  const maxAttempts = Number(job.max_attempts);
  const dead = !error.retryable || attempts >= maxAttempts;
  const next = new Date(Date.now() + calculateBackoffMs(attempts, error.retryAfterSeconds)).toISOString();
  await sql`UPDATE jobs SET status=${dead ? "DEAD" : "RETRY"},next_attempt_at=${next},locked_at=NULL,updated_at=NOW(),last_error_code=${error.code},last_error_message=${error.message.slice(0, 300)} WHERE id=${id}`;
  return dead;
}
