import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawCode = (body?.code ?? "") as string;

    // IMPORTANT: trim BOTH sides to avoid invisible whitespace/newline issues in Railway vars
    const provided = String(rawCode).trim();
    const expected = String(process.env.UPLOAD_CODE ?? "").trim();

    if (!expected) {
      // This means the server runtime does not see UPLOAD_CODE at all.
      // (Even if Railway UI shows it, it may not be reaching this running service.)
      return NextResponse.json(
        { message: "Server missing UPLOAD_CODE (runtime env not loaded)" },
        { status: 500 }
      );
    }

    if (!provided) {
      return NextResponse.json(
        { message: "Missing upload code" },
        { status: 400 }
      );
    }

    if (provided !== expected) {
      return NextResponse.json(
        { message: "Invalid upload code" },
        { status: 401 }
      );
    }

    const filename = String(body?.filename ?? "").trim();
    const contentType = String(body?.contentType ?? "application/octet-stream").trim();
    const category = String(body?.category ?? "general").trim() || "general";
    const title = body?.title;

    if (!filename) {
      return NextResponse.json(
        { message: "Missing filename" },
        { status: 400 }
      );
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeCategory = category.replace(/[^a-zA-Z0-9._-]/g, "_");

    const key = `docs/${safeCategory}/${crypto
      .randomBytes(8)
      .toString("hex")}-${safeName}`;

    const bucket = String(process.env.S3_BUCKET || "fuzedocs").trim();
    const region = String(process.env.AWS_REGION || "us-east-2").trim();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 10, // 10 minutes
    });

    return NextResponse.json({
      uploadUrl,
      key,
      title,
      category: safeCategory,
      bucket,
      region,
    });
  } catch (err: any) {
    console.error("sign-upload error:", err?.message || err);
    return NextResponse.json(
      { message: `Failed to sign upload: ${err?.message || "unknown error"}` },
      { status: 500 }
    );
  }
}