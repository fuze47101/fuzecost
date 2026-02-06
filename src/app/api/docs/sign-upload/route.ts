import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

const BUCKET = String(process.env.S3_BUCKET || "fuzedocs").trim();
const KEY = "docs/_meta/categories.json";

function norm(s: string) {
  return String(s ?? "").trim();
}

async function streamToString(stream: any): Promise<string> {
  // AWS SDK v3 returns a Readable stream in Node
  return await new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

async function loadCategories(): Promise<string[]> {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
    const text = await streamToString(out.Body);
    const parsed = JSON.parse(text);

    const arr = Array.isArray(parsed?.categories) ? parsed.categories : [];
    const cleaned = arr
      .map((x: any) => norm(x))
      .filter(Boolean);

    // de-dupe case-insensitive, preserve first occurrence
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const c of cleaned) {
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(c);
    }

    return deduped;
  } catch (e: any) {
    // If file doesn't exist yet, return defaults
    return ["Regulatory", "Technical", "Marketing", "Training", "General"];
  }
}

async function saveCategories(categories: string[]) {
  const payload = JSON.stringify(
    {
      categories,
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  );

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      Body: payload,
      ContentType: "application/json",
    })
  );
}

export async function GET(req: NextRequest) {
  // Read requires VIEW_CODE (or UPLOAD_CODE as fallback)
  const viewExpected = norm(process.env.VIEW_CODE || "");
  const uploadExpected = norm(process.env.UPLOAD_CODE || "");

  const provided = norm(req.headers.get("x-view-code") || req.nextUrl.searchParams.get("code") || "");

  // If neither code is configured, allow read (dev safety)
  if (!viewExpected && !uploadExpected) {
    const categories = await loadCategories();
    return NextResponse.json({ categories });
  }

  // Accept view code, or upload code
  const ok =
    (viewExpected && provided === viewExpected) ||
    (uploadExpected && provided === uploadExpected);

  if (!ok) {
    return NextResponse.json({ message: "Invalid view code" }, { status: 401 });
  }

  const categories = await loadCategories();
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  // Write requires UPLOAD_CODE
  const expected = norm(process.env.UPLOAD_CODE || "");
  if (!expected) {
    return NextResponse.json(
      { message: "Server missing UPLOAD_CODE" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({} as any));
  const provided = norm(body?.code || "");
  if (provided !== expected) {
    return NextResponse.json({ message: "Invalid upload code" }, { status: 401 });
  }

  const newCategory = norm(body?.category || "");
  if (!newCategory) {
    return NextResponse.json({ message: "Missing category" }, { status: 400 });
  }

  const categories = await loadCategories();

  const exists = categories.some((c) => c.toLowerCase() === newCategory.toLowerCase());
  if (!exists) {
    categories.push(newCategory);
    await saveCategories(categories);
  }

  return NextResponse.json({ categories });
}