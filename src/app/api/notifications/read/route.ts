import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
export async function POST(){await sql`UPDATE notifications SET is_read=TRUE`;return NextResponse.json({ok:true});}
