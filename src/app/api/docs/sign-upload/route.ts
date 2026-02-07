import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

function clean(s: any) {
  return String(s ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const provided = clean(body?.code);
    const expected = clean(process.env.DOCS_UPLOAD_CODE ?? process.env.UPLOAD_CODE ?? "");
    const verifyOnly = Boolean(body?.verifyOnly);

    if (!expected) {
      return NextResponse.json(
        { message: "Server missing DOCS_UPLOAD_CODE/UPLOAD_CODE (runtime env not loaded)" },
        { status: 500 }
      );
    }
    if (!provided) {
      return NextResponse.json({ message: "Missing upload code" }, { status: 400 });
    }
    if (provided !== expected) {
      return NextResponse.json({ message: "Invalid upload code" }, { status: 401 });
    }

    // Verify-only mode for Enable Upload
    if (verifyOnly) {
      return NextResponse.json({ ok: true });
    }

    const filename = clean(body?.filename);
    if (!filename) {
      return NextResponse.json({ message: "Missing filename" }, { status: 400 });
    }

    const contentType = clean(body?.contentType) || "application/octet-stream";

    // ✅ HARDEN: default category if missing
    const rawCategory = clean(body?.category) || "General";

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeCategory = rawCategory.replace(/[^a-zA-Z0-9._-]/g, "_");

    const key = `docs/${safeCategory}/${crypto.randomBytes(8).toString("hex")}-${safeName}`;

    const bucket = clean(process.env.S3_BUCKET || "fuzedocs");

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 10 });

    return NextResponse.json({
      uploadUrl,
      key,
      bucket,
      category: safeCategory,
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