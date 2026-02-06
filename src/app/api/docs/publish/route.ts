import { NextResponse } from "next/server";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, DOCS_BUCKET, DOCS_PREFIX } from "@/lib/s3";

async function streamToString(stream: any): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

export async function POST(req: Request) {
  const { code, entry } = await req.json();

  if (!process.env.DOCS_UPLOAD_CODE || code !== process.env.DOCS_UPLOAD_CODE) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  if (!entry?.title || !entry?.category || !entry?.key) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const manifestKey = `${DOCS_PREFIX}/manifest.json`;

  const existingObj = await s3.send(
    new GetObjectCommand({ Bucket: DOCS_BUCKET, Key: manifestKey })
  );
  const existingText = await streamToString(existingObj.Body);

  let manifest: any[] = [];
  try {
    manifest = JSON.parse(existingText || "[]");
  } catch {
    manifest = [];
  }

  manifest.unshift({
    title: entry.title,
    category: entry.category,
    key: entry.key,
    contentType: entry.contentType || "",
    updatedAt: new Date().toISOString(),
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: DOCS_BUCKET,
      Key: manifestKey,
      ContentType: "application/json",
      Body: JSON.stringify(manifest, null, 2),
    })
  );

  return NextResponse.json({ ok: true });
}
