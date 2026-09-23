import { sql } from "@/lib/db";
import type { CapturedFields } from "@/lib/automation";

export async function upsertLead(customerId: number, captured: CapturedFields, source: string, stamp: string) {
  const rows = await sql`
    INSERT INTO leads(customer_id,product,phone,status,source,owner,created_at,updated_at)
    VALUES(${customerId},${captured.interestedProduct ?? "Oversize Classic"},${captured.phone ?? null},'NEW',${source},'ทีมขาย',${stamp},${stamp})
    ON CONFLICT(customer_id) DO UPDATE SET
      product=COALESCE(EXCLUDED.product,leads.product),
      phone=COALESCE(EXCLUDED.phone,leads.phone),
      status=CASE WHEN leads.status IN ('WON','LOST') THEN leads.status ELSE 'INTERESTED' END,
      updated_at=EXCLUDED.updated_at
    RETURNING id,(xmax = 0) AS inserted` as { id: number; inserted: boolean }[];
  return rows[0];
}
