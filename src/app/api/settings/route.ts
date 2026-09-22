import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
const schema=z.object({storeName:z.string().trim().min(2).max(80),phone:z.string().trim().min(8).max(30),welcomeMessage:z.string().trim().min(10).max(500),demoMode:z.boolean(),channelId:z.string().trim().max(100),channelSecret:z.string().max(200).optional(),accessToken:z.string().max(1000).optional()});
export async function PUT(request:Request){const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"กรุณาตรวจสอบข้อมูลร้านและ LINE OA"},{status:400});const d=parsed.data;await sql`UPDATE settings SET store_name=${d.storeName},phone=${d.phone},welcome_message=${d.welcomeMessage},demo_mode=${d.demoMode},channel_id=${d.channelId},channel_secret=COALESCE(NULLIF(${d.channelSecret??""},''),channel_secret),access_token=COALESCE(NULLIF(${d.accessToken??""},''),access_token) WHERE id=1`;return NextResponse.json({ok:true});}
