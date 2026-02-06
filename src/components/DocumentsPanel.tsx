"use client";

import { useEffect, useState } from "react";

export default function DocumentsPanel() {
  const [viewCode, setViewCode] = useState("");
  const [uploadCode, setUploadCode] = useState("");
  const [viewUnlocked, setViewUnlocked] = useState(false);
  const [uploadUnlocked, setUploadUnlocked] = useState(false);

  const [categories, setCategories] = useState<string[]>([
    "Regulatory",
    "Technical",
    "Marketing",
    "Training",
    "General",
  ]);
  const [category, setCategory] = useState<string>("Regulatory");
  const [newCategory, setNewCategory] = useState<string>("");

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function loadCategoriesFromServer(codeForRead: string) {
    try {
      const res = await fetch("/api/docs/categories", {
        method: "GET",
        headers: {
          "x-view-code": codeForRead.trim(),
        },
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        // Don’t block UI; just show why server didn’t return list
        setStatus(`❌ ${json?.message || "Failed to load categories"} (HTTP ${res.status})`);
        return;
      }

      const list = Array.isArray(json?.categories) ? json.categories : [];
      if (list.length) {
        setCategories(list);
        if (!list.some((c: string) => c === category)) {
          setCategory(list[0]);
        }
      }
    } catch (e: any) {
      setStatus(`❌ Failed to load categories: ${e?.message || "network error"}`);
    }
  }

  function unlockView() {
    if (!viewCode.trim()) return;
    setViewUnlocked(true);
    setStatus("✅ View enabled");

    // Load categories using view code
    loadCategoriesFromServer(viewCode);
  }

  async function unlockUpload() {
    if (!uploadCode.trim()) {
      setStatus("Enter the upload code first.");
      return;
    }

    try {
      setBusy(true);
      setStatus("Verifying upload code…");

      const res = await fetch("/api/docs/sign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: uploadCode.trim(),
          verifyOnly: true,
        }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setUploadUnlocked(false);
        setStatus(`❌ ${json?.message || "Upload code verification failed"} (HTTP ${res.status})`);
        return;
      }

      setUploadUnlocked(true);
      setStatus("✅ Upload enabled");

      // Load categories using upload code (allowed by server)
      loadCategoriesFromServer(uploadCode);
    } catch (e: any) {
      setUploadUnlocked(false);
      setStatus(`❌ Verification error: ${e?.message || "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    const c = newCategory.trim();
    if (!c) return;

    if (!uploadUnlocked) {
      setStatus("Enable Upload first (required to create categories).");
      return;
    }

    try {
      setBusy(true);
      setStatus("Saving category…");

      const res = await fetch("/api/docs/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: uploadCode.trim(),
          category: c,
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setStatus(`❌ ${json?.message || "Failed to save category"} (HTTP ${res.status})`);
        return;
      }

      const list = Array.isArray(json?.categories) ? json.categories : [];
      if (list.length) {
        setCategories(list);
        setCategory(c);
        setNewCategory("");
        setStatus(`✅ Category added: "${c}"`);
      } else {
        setStatus("✅ Category saved");
      }
    } catch (e: any) {
      setStatus(`❌ Failed to save category: ${e?.message || "network error"}`);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndPublish() {
    if (!uploadUnlocked) {
      setStatus("Enable Upload first.");
      return;
    }
    if (!file) {
      setStatus("Choose a file first.");
      return;
    }

    try {
      setBusy(true);
      setStatus("Authorizing upload…");

      const sign = await fetch("/api/docs/sign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: uploadCode.trim(),
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          category,
          title,
        }),
      });

      const signJson = await sign.json().catch(() => ({} as any));

      if (!sign.ok) {
        setStatus(`❌ ${signJson?.message || "Upload authorization failed"} (HTTP ${sign.status})`);
        return;
      }

      const { uploadUrl, key } = signJson;

      if (!uploadUrl) {
        setStatus("❌ Server did not return an upload URL.");
        return;
      }

      setStatus("Uploading…");

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!put.ok) {
        setStatus(`❌ S3 upload failed (HTTP ${put.status})`);
        return;
      }

      setStatus(`✅ Uploaded successfully: ${key || ""}`);
      setFile(null);
      setTitle("");
    } catch (err: any) {
      setStatus(`❌ Unexpected error: ${err?.message || "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  // If user unlocks view after upload already unlocked or vice versa, optionally refresh categories
  useEffect(() => {
    // no-op; keeping hook for future expansions
  }, [viewUnlocked, uploadUnlocked]);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Documents</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium">View code</label>
            <div className="flex gap-2 mt-1 items-center">
              <input
                className="border rounded px-2 py-1 max-w-xs w-full"
                value={viewCode}
                onChange={(e) => setViewCode(e.target.value)}
                placeholder="Enter view code"
              />
              <button
                className="px-3 py-1 rounded bg-black text-white"
                onClick={unlockView}
                type="button"
              >
                Unlock
              </button>
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Unlocks the document list and downloads.
            </div>
            {viewUnlocked && (
              <div className="text-xs text-green-700 mt-1">View is enabled.</div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Upload code</label>
            <div className="flex gap-2 mt-1 items-center">
              <input
                className="border rounded px-2 py-1 max-w-xs w-full"
                value={uploadCode}
                onChange={(e) => setUploadCode(e.target.value)}
                placeholder="Enter upload code"
              />
              <button
                className="px-3 py-1 rounded bg-black text-white"
                onClick={unlockUpload}
                disabled={busy || !uploadCode.trim()}
                type="button"
              >
                Enable Upload
              </button>
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Upload unlocks only after server verification.
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
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <div className="mt-2 flex gap-2">
                <input
                  className="border rounded px-2 py-1 w-full"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder='Add new category (e.g., "Factory Training")'
                />
                <button
                  className="px-3 py-1 rounded bg-black text-white"
                  onClick={addCategory}
                  type="button"
                  disabled={busy || !newCategory.trim()}
                >
                  Add
                </button>
              </div>

              <div className="text-xs text-neutral-500 mt-1">
                Categories are saved on the server (S3) and persist for everyone.
              </div>
            </div>

            <div>
              <label className="text-sm">Title</label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional title"
              />
            </div>
          </div>

          <div>
            <label className="text-sm block mb-1">File</label>

            <label className="inline-block px-4 py-2 bg-neutral-200 rounded cursor-pointer">
              Choose File
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>

            {file && (
              <div className="text-xs mt-2 text-neutral-600">
                Selected: {file.name}
              </div>
            )}
          </div>

          <button
            onClick={uploadAndPublish}
            disabled={busy}
            className="px-4 py-2 rounded bg-black text-white"
            type="button"
          >
            Upload &amp; Publish
          </button>

          {status && <div className="text-sm whitespace-pre-wrap">{status}</div>}
        </div>
      )}

      {!uploadUnlocked && status && (
        <div className="text-sm whitespace-pre-wrap">{status}</div>
      )}
    </div>
  );
}