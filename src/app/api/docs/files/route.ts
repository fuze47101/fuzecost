import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

function clean(s: any) {
  return String(s ?? "").trim();
}

// MUST match sign-upload route logic
function safeCategoryName(raw: string) {
  return clean(raw || "General").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function extractViewCode(req: NextRequest) {
  const h = req.headers;
  const direct = clean(h.get("x-view-code")) || clean(h.get("x-docs-code"));
  if (direct) return direct;

  const auth = clean(h.get("authorization"));
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return clean(m[1]);

  return clean(req.nextUrl.searchParams.get("code"));
}

function expectedViewCode() {
  return clean(process.env.DOCS_VIEW_CODE ?? process.env.VIEW_CODE ?? "");
}

export async function GET(req: NextRequest) {
  try {
    const expected = expectedViewCode();
    const provided = extractViewCode(req);

    if (!expected) {
      return NextResponse.json(
        { message: "Server missing DOCS_VIEW_CODE/VIEW_CODE" },
        { status: 500 }
      );
    }
    if (!provided) {
      return NextResponse.json({ message: "Missing view code" }, { status: 400 });
    }
    if (provided !== expected) {
      return NextResponse.json({ message: "Invalid view code" }, { status: 401 });
    }

    const rawCategory = clean(req.nextUrl.searchParams.get("category"));
    if (!rawCategory) {
      return NextResponse.json({ message: "Missing category" }, { status: 400 });
    }

    const category = safeCategoryName(rawCategory);

    // Match sign-upload bucket behavior
    const bucket = clean(process.env.S3_BUCKET ?? process.env.DOCS_BUCKET ?? "fuzedocs");
    const prefix = `docs/${category}/`;

    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
      })
    );

    const files =
      (out.Contents ?? [])
        .map((o) => o.Key || "")
        .filter((k) => k && !k.endsWith("/"))
        .map((k) => ({ key: k, name: k.slice(prefix.length) }))
        .filter((f) => f.name);

    return NextResponse.json({ bucket, category, prefix, files });
  } catch (err: any) {
    console.error("files list error:", err?.message || err);
    return NextResponse.json(
      { message: `Failed to list files: ${err?.message || "unknown error"}` },
      { status: 500 }
    );
  }
}