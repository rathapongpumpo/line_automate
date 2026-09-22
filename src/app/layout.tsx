import type{Metadata}from"next";import{Geist}from"next/font/google";import type{ReactNode}from"react";import"./globals.css";import{ToastProvider}from"@/components/ui";
const geist=Geist({variable:"--font-geist",subsets:["latin"]});export const metadata:Metadata={title:"LINE Sales Assistant",description:"รวมแชตลูกค้า เก็บ Lead และตอบคำถามอัตโนมัติในที่เดียว"};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="th" className={geist.variable}><body><ToastProvider>{children}</ToastProvider></body></html>}
