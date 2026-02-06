"use client";

import { useState } from "react";

type Category =
  | "Regulatory"
  | "Technical"
  | "Marketing"
  | "General";

export default function DocumentsPanel() {
  const [viewCode, setViewCode] = useState("");
  const [uploadCode, setUploadCode] = useState("");
  const [viewUnlocked, setViewUnlocked] = useState(false);
  const [uploadUnlocked, setUploadUnlocked] = useState(false);

  const [category, setCategory] = useState<Category>("Regulatory");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  function unlockView() {
    if (!viewCode.trim()) return;
    setViewUnlocked(true);
  }

  function unlockUpload() {
    if (!uploadCode.trim()) return;
    setUploadUnlocked(true);
  }

  async function uploadAndPublish() {
    if (!file || !uploadCode.trim()) return;

    try {
      setBusy(true);
      setStatus("Authorizing upload…");

      const sign = await fetch("/api/docs/sign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: uploadCode.trim(),
          filename: file.name,
          contentType: file.type,
          category,
          title,
        }),
      });

      if (!sign.ok) {
        throw new Error("Invalid upload code");
      }

      const { uploadUrl } = await sign.json();

      setStatus("Uploading to secure storage…");

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });

      if (!put.ok) {
        throw new Error("Upload failed");
      }

      setStatus("✅ Uploaded and published");
      setFile(null);
      setTitle("");
    } catch (err: any) {
      setStatus(err.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Documents</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium">View code</label>
            <div className="flex gap-2 mt-1">
              <input
                className="border rounded px-2 py-1 w-full"
                value={viewCode}
                onChange={(e) => setViewCode(e.target.value)}
              />
              <button
                className="px-3 py-1 rounded bg-black text-white"
                onClick={unlockView}
              >
                Unlock
              </button>
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Unlocks the document list and downloads.
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Upload code</label>
            <div className="flex gap-2 mt-1">
              <input
                className="border rounded px-2 py-1 w-full"
                value={uploadCode}
                onChange={(e) => setUploadCode(e.target.value)}
              />
              <button
                className="px-3 py-1 rounded bg-black text-white"
                onClick={unlockUpload}
              >
                Enable Upload
              </button>
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Enables uploading new files and publishing them.
            </div>
          </div>
        </div>
      </div>

      {uploadUnlocked && (
        <div className="rounded-lg border p-6 space-y-4">
          <h3 className="text-md font-semibold">Upload &amp; Publish</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Category</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as Category)
                }
              >
                <option>Regulatory</option>
                <option>Technical</option>
                <option>Marketing</option>
                <option>General</option>
              </select>
            </div>

            <div>
              <label className="text-sm">Title</label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., FUZE F1 SDS (PDF)"
              />
            </div>
          </div>

          <div>
            <label className="text-sm">File</label>
            <input
              type="file"
              className="block mt-1"
              onChange={(e) =>
                setFile(e.target.files?.[0] || null)
              }
            />
            <div className="text-xs text-neutral-500 mt-1">
              Allowed: PDF, JPG/PNG, MP4, PPT/PPTX
            </div>
          </div>

          <button
            onClick={uploadAndPublish}
            disabled={busy}
            className="px-4 py-2 rounded bg-black text-white"
          >
            Upload &amp; Publish
          </button>

          {status && <div className="text-sm">{status}</div>}
        </div>
      )}
    </div>
  );
}
