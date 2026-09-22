import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
const schema=z.object({id:z.number().int().positive(),enabled:z.boolean(),value:z.string().max(300).nullable().optional()});
export async function PATCH(request:Request){const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"ข้อมูล Rule ไม่ถูกต้อง"},{status:400});const result=db.prepare("UPDATE automation_rules SET enabled=?,value=COALESCE(?,value) WHERE id=?").run(parsed.data.enabled?1:0,parsed.data.value??null,parsed.data.id);return result.changes?NextResponse.json({ok:true}):NextResponse.json({error:"ไม่พบ Rule"},{status:404});}
