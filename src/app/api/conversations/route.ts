import { NextResponse } from "next/server";
import { sql, toIso } from "@/lib/db";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 100);
  const query = (url.searchParams.get("q") ?? "").trim();
  const selectedValue = Number(url.searchParams.get("selected"));
  const selected = Number.isInteger(selectedValue) && selectedValue > 0 ? selectedValue : 0;
  const offset = (page - 1) * limit;
  const rows = query
    ? await sql`SELECT v.*,c.line_user_id,c.display_name,c.name,c.phone,c.email,c.tags,c.interested_product,c.color,c.size,c.picture_url,c.language,c.profile_synced_at,c.followed_at,c.unfollowed_at,c.created_at AS customer_created_at,c.updated_at AS customer_updated_at FROM conversations v JOIN customers c ON c.id=v.customer_id WHERE c.display_name ILIKE ${`%${query}%`} OR v.last_message ILIKE ${`%${query}%`} ORDER BY (v.id=${selected}) DESC,v.last_message_at DESC LIMIT ${limit} OFFSET ${offset}`
    : await sql`SELECT v.*,c.line_user_id,c.display_name,c.name,c.phone,c.email,c.tags,c.interested_product,c.color,c.size,c.picture_url,c.language,c.profile_synced_at,c.followed_at,c.unfollowed_at,c.created_at AS customer_created_at,c.updated_at AS customer_updated_at FROM conversations v JOIN customers c ON c.id=v.customer_id ORDER BY (v.id=${selected}) DESC,v.last_message_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const items = (rows as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id), status: String(row.status), lastMessage: String(row.last_message), lastMessageAt: toIso(row.last_message_at), createdAt: toIso(row.created_at),
    customer: { id: Number(row.customer_id), lineUserId: String(row.line_user_id), displayName: String(row.display_name), name: row.name ? String(row.name) : null, phone: row.phone ? String(row.phone) : null, email: row.email ? String(row.email) : null, tags: Array.isArray(row.tags) ? row.tags.map(String) : [], interestedProduct: row.interested_product ? String(row.interested_product) : null, color: row.color ? String(row.color) : null, size: row.size ? String(row.size) : null, pictureUrl: row.picture_url ? String(row.picture_url) : null, language: row.language ? String(row.language) : null, profileSyncedAt: row.profile_synced_at ? toIso(row.profile_synced_at) : null, followedAt: row.followed_at ? toIso(row.followed_at) : null, unfollowedAt: row.unfollowed_at ? toIso(row.unfollowed_at) : null, createdAt: toIso(row.customer_created_at), updatedAt: toIso(row.customer_updated_at) },
  }));
  return NextResponse.json({ items, page, hasMore: rows.length === limit });
}
