"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type DocItem = {
  title: string;
  category: string;
  key: string;
  contentType?: string;
  updatedAt?: string;
};

function extFromKey(key: string) {
  const m = key.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export default function DocumentsPanel() {
  const [viewCode, setViewCode] = useState("");
  const [uploadCode, setUploadCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [uploadUnlocked, setUploadUnlocked] = useState(false);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [search, setSearch] = useState("");

  // upload form
  const [category, setCategory] = useState("marketing");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(d =>
      (d.title || "").toLowerCase().includes(q) ||
      (d.category || "").toLowerCase().includes(q)
    );
  }, [docs, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, DocItem[]>();
    for (const d of filtered) {
      const k = d.category || "Other";
      map.set(k, [...(map.get(k) || []), d]);
    }
    return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
  }, [filtered]);

  async function loadDocs(code: string) {
    setMsg("");
    const res = await fetch("/api/docs/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      setMsg("Invalid view code.");
      setUnlocked(false);
      setDocs([]);
      return;
    }
    const json = await res.json();
    setDocs(Array.isArray(json.manifest) ? json.manifest : []);
    setUnlocked(true);
  }

  async function unlockView() {
    await loadDocs(viewCode.trim());
  }

  function unlockUpload() {
    if (!uploadCode.trim()) return;
    // we don't verify upload code until first upload attempt (keeps it simple)
    setUploadUnlocked(true);
    setMsg("");
  }

  async function uploadAndPublish() {
    if (!file) return setMsg("Choose a file first.");
    if (!title.trim()) return setMsg("Enter a title.");
    setBusy(true);
    setMsg("");

    try {
      // 1) get presigned URL
      const sign = await fetch("/api/docs/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: uploadCode.trim(),
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          folder: category,
        }),
      });

      if (!sign.ok) {
        const j = await sign.json().catch(() => ({}));
        setMsg(j?.error || "Upload code invalid or file type not allowed.");
        setBusy(false);
        return;
      }

      const { url, key } = await sign.json();

      // 2) PUT to S3
      const put = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!put.ok) {
        setMsg("Upload failed while sending file.");
        setBusy(false);
        return;
      }

      // 3) publish to manifest
      const pub = await fetch("/api/docs/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: uploadCode.trim(),
          entry: {
            title: title.trim(),
            category: category.toUpperCase(),
            key,
            contentType: file.type,
          },
        }),
      });

      if (!pub.ok) {
        const j = await pub.json().catch(() => ({}));
        setMsg(j?.error || "Uploaded file but failed to publish.");
        setBusy(false);
        return;
      }

      setMsg("Uploaded and published.");
      setTitle("");
      setFile(null);

      // refresh list (requires view code)
      if (unlocked) {
        await loadDocs(viewCode.trim());
      }

    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-600">View code</div>
              <div className="flex gap-2">
                <Input value={viewCode} onChange={(e) => setViewCode(e.target.value)} placeholder="Enter view code" />
                <Button onClick={unlockView} disabled={!viewCode.trim()}>Unlock</Button>
              </div>
              <div className="text-xs text-neutral-500">Unlocks the document list and downloads.</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-600">Upload code</div>
              <div className="flex gap-2">
                <Input value={uploadCode} onChange={(e) => setUploadCode(e.target.value)} placeholder="Enter upload code" />
                <Button variant="secondary" onClick={unlockUpload} disabled={!uploadCode.trim()}>Enable Upload</Button>
              </div>
              <div className="text-xs text-neutral-500">Enables uploading new files and publishing them.</div>
            </div>
          </div>

          {!!msg && <div className="text-sm text-neutral-700">{msg}</div>}

          {unlocked && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-neutral-600">
                  {docs.length} file{docs.length === 1 ? "" : "s"}
                </div>
                <Input
                  className="max-w-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents…"
                />
              </div>

              {grouped.length === 0 ? (
                <div className="rounded-xl border bg-white p-4 text-sm text-neutral-600">
                  No documents published yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {grouped.map(([cat, items]) => (
                    <div key={cat} className="space-y-2">
                      <div className="text-xs font-semibold text-neutral-600">{cat}</div>
                      <div className="rounded-2xl border bg-white">
                        {items.map((d, i) => {
                          const ext = extFromKey(d.key);
                          // we use a simple download link via a dynamic API route later; for now, show key
                          return (
                            <div key={d.key} className={`flex items-center justify-between gap-3 px-4 py-3 ${i ? "border-t" : ""}`}>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{d.title}</div>
                                <div className="text-xs text-neutral-500 truncate">{d.key}</div>
                              </div>
                              <a
                                className="text-xs underline underline-offset-2 text-neutral-700 whitespace-nowrap"
                                href={`/api/docs/download?code=${encodeURIComponent(viewCode.trim())}&key=${encodeURIComponent(d.key)}`}
                              >
                                Download{ext ? ` (${ext})` : ""}
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {uploadUnlocked && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Upload & Publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs font-medium text-neutral-600">Category</div>
                <select
                  className="h-10 w-full rounded-xl border bg-white px-3 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="regulatory">Regulatory</option>
                  <option value="marketing">Marketing</option>
                  <option value="guidelines">Guidelines</option>
                  <option value="videos">Videos</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <div className="text-xs font-medium text-neutral-600">Title</div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., FUZE F1 SDS (PDF)" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-600">File</div>
              <input
                type="file"
                className="block w-full text-sm"
                accept=".pdf,.jpg,.jpeg,.png,.mp4,.ppt,.pptx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="text-xs text-neutral-500">
                Allowed: PDF, JPG/PNG, MP4, PPT/PPTX
              </div>
            </div>

            <Button onClick={uploadAndPublish} disabled={busy}>
              {busy ? "Uploading…" : "Upload & Publish"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
