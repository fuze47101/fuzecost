import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, DOCS_BUCKET, DOCS_PREFIX } from "@/lib/s3";

async function streamToString(stream: any): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

export async function POST(req: Request) {
  const { code } = await req.json();

  if (!process.env.DOCS_VIEW_CODE || code !== process.env.DOCS_VIEW_CODE) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  const key = `${DOCS_PREFIX}/manifest.json`;
  const obj = await s3.send(new GetObjectCommand({ Bucket: DOCS_BUCKET, Key: key }));
  const text = await streamToString(obj.Body);

  let manifest: any[] = [];
  try {
    manifest = JSON.parse(text || "[]");
  } catch {
    manifest = [];
  }

  return NextResponse.json({ manifest });
}
