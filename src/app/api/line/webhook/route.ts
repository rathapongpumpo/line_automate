import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSmartReply } from "@/lib/automation";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
type LineEvent={webhookEventId?:string;type:string;replyToken?:string;source?:{userId?:string};message?:{type:string;text?:string};timestamp?:number};

function validSignature(body:string,signature:string|null,secret:string){if(!signature)return false;const expected=crypto.createHmac("sha256",secret).update(body).digest("base64");return signature.length===expected.length&&crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected));}

async function replyToLine(replyToken:string,text:string,token:string){const response=await fetch("https://api.line.me/v2/bot/message/reply",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({replyToken,messages:[{type:"text",text}]})});if(!response.ok)throw new Error(`LINE reply failed: ${response.status}`);}

export async function POST(request:Request){
  const raw=await request.text();const secret=process.env.LINE_CHANNEL_SECRET||"";const token=process.env.LINE_CHANNEL_ACCESS_TOKEN||"";
  if(!secret||!validSignature(raw,request.headers.get("x-line-signature"),secret))return NextResponse.json({error:"Invalid signature"},{status:401});
  let payload:{events:LineEvent[]};try{payload=JSON.parse(raw) as {events:LineEvent[]};}catch{return NextResponse.json({error:"Invalid payload"},{status:400});}
  for(const event of payload.events){
    const message=event.message?.text;const userId=event.source?.userId;
    if(event.type!=="message"||event.message?.type!=="text"||!message||!userId)continue;
    if(event.webhookEventId){
      const inserted=await sql`INSERT INTO processed_webhooks(event_id,processed_at) VALUES(${event.webhookEventId},${new Date().toISOString()}) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`;
      if(!inserted.length)continue;
    }
    const faqRows=await sql`SELECT question,answer,keywords FROM faqs WHERE active=TRUE` as {question:string;answer:string;keywords:unknown}[];
    const smart=createSmartReply(message,faqRows.map((item)=>({question:item.question,answer:item.answer,keywords:Array.isArray(item.keywords)?item.keywords.map(String):[]})));
    const stamp=new Date(event.timestamp||Date.now()).toISOString();
    const [customer]=await sql`
      INSERT INTO customers(line_user_id,display_name,tags,created_at,updated_at)
      VALUES(${userId},'ลูกค้า LINE','["ลูกค้าใหม่"]'::jsonb,${stamp},${stamp})
      ON CONFLICT(line_user_id) DO UPDATE SET updated_at=EXCLUDED.updated_at RETURNING id` as {id:number}[];
    let [conversation]=await sql`SELECT id FROM conversations WHERE customer_id=${customer.id} AND status!='CLOSED' ORDER BY id DESC LIMIT 1` as {id:number}[];
    if(!conversation){
      [conversation]=await sql`
        INSERT INTO conversations(customer_id,status,last_message,last_message_at,created_at)
        VALUES(${customer.id},'AUTO',${message},${stamp},${stamp}) RETURNING id` as {id:number}[];
    }
    await sql.transaction([
      sql`INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(${conversation.id},'CUSTOMER',${message},${stamp})`,
      sql`INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(${conversation.id},'SYSTEM',${smart.reply},${new Date(Date.now()+300).toISOString()})`,
      sql`UPDATE conversations SET status=${smart.needsAdmin?"WAITING":"AUTO"},last_message=${message},last_message_at=${stamp} WHERE id=${conversation.id}`,
    ]);
    if(smart.shouldCreateLead){
      await sql`INSERT INTO leads(customer_id,product,phone,status,source,owner,created_at,updated_at)
        VALUES(${customer.id},${smart.captured.interestedProduct??"Oversize Classic"},${smart.captured.phone??null},'NEW','LINE OA','ทีมขาย',${stamp},${stamp})
        ON CONFLICT(customer_id) DO UPDATE SET phone=COALESCE(EXCLUDED.phone,leads.phone),status='INTERESTED',updated_at=EXCLUDED.updated_at`;
    }
    if(event.replyToken&&token)await replyToLine(event.replyToken,smart.reply,token);
  }
  return NextResponse.json({ok:true});
}
