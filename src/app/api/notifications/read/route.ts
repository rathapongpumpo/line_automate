import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function POST(){db.prepare("UPDATE notifications SET is_read=1").run();return NextResponse.json({ok:true});}
