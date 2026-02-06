import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, DOCS_BUCKET, DOCS_PREFIX } from "@/lib/s3";

const allowed = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "video/mp4",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

function safeName(name: string) {
  return (name || "file")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
  const { code, filename, contentType, folder } = await req.json();

  if (!process.env.DOCS_UPLOAD_CODE || code !== process.env.DOCS_UPLOAD_CODE) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  if (!allowed.has(contentType)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const cleanFolder = safeName(folder || "marketing");
  const cleanFile = safeName(filename || "file");

  const key = `${DOCS_PREFIX}/${cleanFolder}/${ts}-${cleanFile}`;

  const cmd = new PutObjectCommand({
    Bucket: DOCS_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 10 });
  return NextResponse.json({ url, key });
}
