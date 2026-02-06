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
    const { code, filename, contentType, category, title } = body || {};

    if (!code || code !== process.env.UPLOAD_CODE) {
      return NextResponse.json(
        { message: "Invalid upload code" },
        { status: 401 }
      );
    }

    if (!filename) {
      return NextResponse.json(
        { message: "Missing filename" },
        { status: 400 }
      );
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `docs/${category || "general"}/${crypto
      .randomBytes(8)
      .toString("hex")}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET || "fuzedocs",
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
      category,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Failed to sign upload" },
      { status: 500 }
    );
  }
}
