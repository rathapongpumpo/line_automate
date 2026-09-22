import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
const schema=z.object({id:z.number().int().positive(),enabled:z.boolean(),value:z.string().max(300).nullable().optional()});
export async function PATCH(request:Request){const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"ข้อมูล Rule ไม่ถูกต้อง"},{status:400});const rows=await sql`UPDATE automation_rules SET enabled=${parsed.data.enabled},value=COALESCE(${parsed.data.value??null},value) WHERE id=${parsed.data.id} RETURNING id`;return rows.length?NextResponse.json({ok:true}):NextResponse.json({error:"ไม่พบ Rule"},{status:404});}
