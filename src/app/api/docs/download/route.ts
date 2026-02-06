import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, DOCS_BUCKET } from "@/lib/s3";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const key = url.searchParams.get("key") || "";

  if (!process.env.DOCS_VIEW_CODE || code !== process.env.DOCS_VIEW_CODE) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const obj = await s3.send(new GetObjectCommand({ Bucket: DOCS_BUCKET, Key: key }));

  const headers = new Headers();
  if (obj.ContentType) headers.set("Content-Type", obj.ContentType);
  headers.set("Cache-Control", "private, max-age=0, no-store");
  headers.set("Content-Disposition", `attachment; filename="${key.split("/").pop() || "download"}"`);

  // @ts-ignore
  return new Response(obj.Body, { headers });
}
