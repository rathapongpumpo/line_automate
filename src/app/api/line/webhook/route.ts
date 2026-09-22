import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSmartReply } from "@/lib/automation";
import { db } from "@/lib/db";

export const runtime = "nodejs";
type LineEvent={webhookEventId?:string;type:string;replyToken?:string;source?:{userId?:string};message?:{type:string;text?:string};timestamp?:number};

function validSignature(body:string,signature:string|null,secret:string){if(!signature)return false;const expected=crypto.createHmac("sha256",secret).update(body).digest("base64");return signature.length===expected.length&&crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected));}

async function replyToLine(replyToken:string,text:string,token:string){const response=await fetch("https://api.line.me/v2/bot/message/reply",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({replyToken,messages:[{type:"text",text}]})});if(!response.ok)throw new Error(`LINE reply failed: ${response.status}`);}

export async function POST(request:Request){
  const raw=await request.text();const secret=process.env.LINE_CHANNEL_SECRET||"";const token=process.env.LINE_CHANNEL_ACCESS_TOKEN||"";
  if(!secret||!validSignature(raw,request.headers.get("x-line-signature"),secret))return NextResponse.json({error:"Invalid signature"},{status:401});
  let payload:{events:LineEvent[]};try{payload=JSON.parse(raw) as {events:LineEvent[]};}catch{return NextResponse.json({error:"Invalid payload"},{status:400});}
  for(const event of payload.events){
    if(event.type!=="message"||event.message?.type!=="text"||!event.message.text||!event.source?.userId)continue;
    if(event.webhookEventId){try{db.prepare("INSERT INTO processed_webhooks(event_id,processed_at) VALUES(?,?)").run(event.webhookEventId,new Date().toISOString());}catch{continue;}}
    const faqRows=db.prepare("SELECT question,answer,keywords FROM faqs WHERE active=1").all() as Array<{question:string;answer:string;keywords:string}>;
    const smart=createSmartReply(event.message.text,faqRows.map((item)=>({...item,keywords:JSON.parse(item.keywords) as string[]})));
    const stamp=new Date(event.timestamp||Date.now()).toISOString();
    const customerRow=db.prepare("SELECT id FROM customers WHERE line_user_id=?").get(event.source.userId) as {id:number}|undefined;
    const customerId=customerRow?.id??Number(db.prepare("INSERT INTO customers(line_user_id,display_name,tags,created_at,updated_at) VALUES(?,?,'[\"ลูกค้าใหม่\"]',?,?)").run(event.source.userId,"ลูกค้า LINE",stamp,stamp).lastInsertRowid);
    let conversation=db.prepare("SELECT id FROM conversations WHERE customer_id=? AND status!='CLOSED' ORDER BY id DESC LIMIT 1").get(customerId) as {id:number}|undefined;
    if(!conversation)conversation={id:Number(db.prepare("INSERT INTO conversations(customer_id,status,last_message,last_message_at,created_at) VALUES(?,'AUTO',?,?,?)").run(customerId,event.message.text,stamp,stamp).lastInsertRowid)};
    db.prepare("INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(?,'CUSTOMER',?,?)").run(conversation.id,event.message.text,stamp);
    db.prepare("INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(?,'SYSTEM',?,?)").run(conversation.id,smart.reply,new Date(Date.now()+300).toISOString());
    db.prepare("UPDATE conversations SET status=?,last_message=?,last_message_at=? WHERE id=?").run(smart.needsAdmin?"WAITING":"AUTO",event.message.text,stamp,conversation.id);
    if(smart.shouldCreateLead)db.prepare("INSERT INTO leads(customer_id,product,phone,status,source,owner,created_at,updated_at) VALUES(?,?,?,'NEW','LINE OA','ทีมขาย',?,?) ON CONFLICT(customer_id) DO UPDATE SET phone=COALESCE(excluded.phone,leads.phone),status='INTERESTED',updated_at=excluded.updated_at").run(customerId,smart.captured.interestedProduct??"Oversize Classic",smart.captured.phone??null,stamp,stamp);
    if(event.replyToken&&token)await replyToLine(event.replyToken,smart.reply,token);
  }
  return NextResponse.json({ok:true});
}
