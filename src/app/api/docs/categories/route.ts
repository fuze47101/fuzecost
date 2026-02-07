import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

const BUCKET = String(process.env.S3_BUCKET || "fuzedocs").trim();
const KEY = "docs/_meta/categories.json";

function norm(s: any) {
  return String(s ?? "").trim();
}

async function streamToString(stream: any): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

function dedupeCaseInsensitive(list: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of list) {
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

async function loadCategories(): Promise<string[]> {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
    const text = await streamToString(out.Body);
    const parsed = JSON.parse(text);

    const arr = Array.isArray(parsed?.categories) ? parsed.categories : [];
    const cleaned = arr.map((x: any) => norm(x)).filter(Boolean);
    const deduped = dedupeCaseInsensitive(cleaned);

    return deduped.length
      ? deduped
      : ["Regulatory", "Technical", "Marketing", "Training", "General"];
  } catch {
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
  // Allow read with VIEW_CODE or UPLOAD_CODE (either is fine)
  const viewExpected = norm(process.env.VIEW_CODE || process.env.DOCS_VIEW_CODE || "");
  const uploadExpected = norm(process.env.UPLOAD_CODE || process.env.DOCS_UPLOAD_CODE || "");

  const provided =
    norm(req.headers.get("x-view-code")) ||
    norm(req.nextUrl.searchParams.get("code"));

  // If no codes configured (dev), allow read
  if (!viewExpected && !uploadExpected) {
    const categories = await loadCategories();
    return NextResponse.json({ categories });
  }

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
  const expected = norm(process.env.UPLOAD_CODE || process.env.DOCS_UPLOAD_CODE || "");
  if (!expected) {
    return NextResponse.json({ message: "Server missing UPLOAD_CODE" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({} as any));
  const provided = norm(body?.code);
  if (provided !== expected) {
    return NextResponse.json({ message: "Invalid upload code" }, { status: 401 });
  }

  const newCategory = norm(body?.category);
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
