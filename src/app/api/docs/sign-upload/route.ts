import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

function clean(s: any) {
  return String(s ?? "").trim();
}

function safeName(s: string) {
  return clean(s).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getBucket() {
  // Prefer DOCS_BUCKET (matches your Railway vars), fall back to S3_BUCKET for legacy
  return clean(process.env.DOCS_BUCKET ?? process.env.S3_BUCKET ?? "fuzedocs");
}

function getPrefix() {
  // Prefer DOCS_PREFIX; default to "docs/"
  const p = clean(process.env.DOCS_PREFIX ?? "docs/");
  return p.replace(/^\/+/, "").replace(/\/?$/, "/");
}

export async function OPTIONS() {
  // Safe no-op for any unexpected preflight behavior
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const provided = clean(body?.code);
    const expected = clean(process.env.DOCS_UPLOAD_CODE ?? process.env.UPLOAD_CODE ?? "");
    const verifyOnly = Boolean(body?.verifyOnly);

    if (!expected) {
      return NextResponse.json(
        { message: "Server missing DOCS_UPLOAD_CODE/UPLOAD_CODE" },
        { status: 500 }
      );
    }
    if (!provided) {
      return NextResponse.json({ message: "Missing upload code" }, { status: 400 });
    }
    if (provided !== expected) {
      return NextResponse.json({ message: "Invalid upload code" }, { status: 401 });
    }

    // Verify-only mode
    if (verifyOnly) {
      return NextResponse.json({ ok: true });
    }

    const filename = clean(body?.filename);
    if (!filename) {
      return NextResponse.json({ message: "Missing filename" }, { status: 400 });
    }

    const contentType = clean(body?.contentType) || "application/octet-stream";

    const rawCategory = clean(body?.category) || "General";
    const category = safeName(rawCategory);

    const bucket = getBucket();
    const prefix = getPrefix();

    const finalName = safeName(filename);
    const key = `${prefix}${category}/${crypto.randomBytes(8).toString("hex")}-${finalName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 10 });

    return NextResponse.json({
      ok: true,
      uploadUrl,
      key,
      bucket,
      category,
      contentType,
    });
  } catch (err: any) {
    console.error("sign-upload error:", err?.message || err);
    return NextResponse.json(
      { message: `Failed to sign upload: ${err?.message || "unknown error"}` },
      { status: 500 }
    );
  }
}