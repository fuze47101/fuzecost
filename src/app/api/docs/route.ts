import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DOCS } from "@/content/docs-manifest";

export const runtime = "nodejs";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  const accessCode = process.env.DOCS_ACCESS_CODE || "";
  const bucket = process.env.DOCS_BUCKET || "";
  const region = process.env.AWS_REGION || "";

  if (!accessCode) return bad("Server misconfigured: DOCS_ACCESS_CODE missing.", 500);
  if (!bucket) return bad("Server misconfigured: DOCS_BUCKET missing.", 500);
  if (!region) return bad("Server misconfigured: AWS_REGION missing.", 500);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body.");
  }

  const code = String(body?.code || "");
  if (!code || code !== accessCode) {
    return bad("Invalid access code.", 401);
  }

  const client = new S3Client({ region });

  // Signed URLs expire quickly on purpose
  const expiresIn = 60 * 15; // 15 minutes

  const items = await Promise.all(
    DOCS.map(async (d) => {
      const cmd = new GetObjectCommand({
        Bucket: bucket,
        Key: d.s3Key,
        ResponseContentDisposition: `attachment; filename="${d.filename}"`,
      });

      const url = await getSignedUrl(client, cmd, { expiresIn });

      return {
        id: d.id,
        title: d.title,
        category: d.category,
        note: d.note || "",
        filename: d.filename,
        url,
      };
    })
  );

  return NextResponse.json({ ok: true, items });
}
