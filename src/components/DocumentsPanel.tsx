"use client";

import React, { useEffect, useMemo, useState } from "react";

type FilesResponse = { files: { key: string; name: string }[] };

function normalizeCategoriesPayload(data: any): string[] {
  if (Array.isArray(data)) return data.filter((x) => typeof x === "string");
  if (data && Array.isArray(data.categories))
    return data.categories.filter((x: any) => typeof x === "string");
  return [];
}

function normalizeFilesPayload(data: any): { key: string; name: string }[] {
  if (!data || !Array.isArray(data.files)) return [];
  return data.files
    .filter((x: any) => x && typeof x.key === "string" && typeof x.name === "string")
    .map((x: any) => ({ key: x.key, name: x.name }));
}

function prettyFileName(raw: string) {
  let name = raw.replace(/^[a-f0-9]{8,}-/i, ""); // strip hash-
  name = name.replace(/[_-]+/g, " ");
  name = name.replace(/\s+/g, " ").trim();
  return name;
}

export default function DocumentsPanel() {
  // Inputs
  const [viewCodeInput, setViewCodeInput] = useState("");
  const [uploadCode, setUploadCode] = useState("");

  // Gates
  const [viewCode, setViewCode] = useState<string | null>(null);
  const [uploadUnlocked, setUploadUnlocked] = useState(false);

  // Data
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [files, setFiles] = useState<{ key: string; name: string }[]>([]);

  // Upload UI
  const [uploadCategory, setUploadCategory] = useState<string>("General");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ name: string; ok: boolean; message?: string }[]>([]);

  // Status
  const [status, setStatus] = useState("");
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const viewUnlocked = useMemo(() => viewCode !== null, [viewCode]);

  function viewHeaders(code: string) {
    return {
      "x-view-code": code,
      authorization: `Bearer ${code}`,
    } as Record<string, string>;
  }

  // ---- Unlock view (server verified) ----
  const onUnlockView = async () => {
    const code = viewCodeInput.trim();
    if (!code) {
      setStatus("Enter a view code.");
      return;
    }

    try {
      setStatus("Verifying view code…");
      setLoadingCats(true);

      const res = await fetch("/api/docs/categories", {
        cache: "no-store",
        headers: viewHeaders(code),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setViewCode(null);
        setCategories([]);
        setActiveCategory(null);
        setFiles([]);
        setStatus(`categories request failed (${res.status}) ${txt}`.trim());
        return;
      }

      const raw = await res.json().catch(() => null);
      const list = normalizeCategoriesPayload(raw);

      setViewCode(code);
      setCategories(list);
      setActiveCategory(list.length ? list[0] : null);
      setFiles([]);
      setStatus(list.length ? "" : "No categories found.");
    } catch (e: any) {
      setViewCode(null);
      setStatus(e?.message ?? "Failed to verify view code.");
    } finally {
      setLoadingCats(false);
    }
  };

  // ---- Enable Upload (verify-only POST) ----
  const onEnableUpload = async () => {
    try {
      setStatus("Verifying upload code…");

      const res = await fetch("/api/docs/sign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: uploadCode.trim(), verifyOnly: true }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setUploadUnlocked(false);
        setStatus(`Upload verify failed (${res.status}) ${txt}`.trim());
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        setUploadUnlocked(true);
        setStatus("Upload enabled.");
      } else {
        setUploadUnlocked(false);
        setStatus("Upload verify failed.");
      }
    } catch (e: any) {
      setUploadUnlocked(false);
      setStatus(e?.message ?? "Upload verify failed.");
    }
  };

  // ---- Load files when category changes ----
  useEffect(() => {
    if (!viewCode || !activeCategory) {
      setFiles([]);
      return;
    }

    const code = viewCode;
    const category = activeCategory;
    let cancelled = false;

    async function run() {
      setLoadingFiles(true);
      setStatus("");

      try {
        const res = await fetch(`/api/docs/files?category=${encodeURIComponent(category)}`, {
          cache: "no-store",
          headers: viewHeaders(code),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`files request failed (${res.status}) ${txt}`.trim());
        }

        const data = (await res.json().catch(() => null)) as FilesResponse;
        const list = normalizeFilesPayload(data);

        if (!cancelled) setFiles(list);
      } catch (e: any) {
        if (!cancelled) {
          setFiles([]);
          setStatus(e?.message ?? "Failed to load files.");
        }
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [viewCode, activeCategory]);

  // ---- Multi-file upload ----
  const onUploadFiles = async () => {
    if (!uploadUnlocked) {
      setStatus("Enable Upload first.");
      return;
    }
    if (selectedFiles.length === 0) {
      setStatus("Choose one or more files to upload.");
      return;
    }

    setUploading(true);
    setUploadResults([]);
    setStatus(`Uploading ${selectedFiles.length} file(s)…`);

    const results: { name: string; ok: boolean; message?: string }[] = [];

    for (const file of selectedFiles) {
      try {
        // 1) Get presigned URL
        const signRes = await fetch("/api/docs/sign-upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: uploadCode.trim(),
            verifyOnly: false,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            category: uploadCategory,
          }),
        });

        if (!signRes.ok) {
          const txt = await signRes.text().catch(() => "");
          results.push({ name: file.name, ok: false, message: `sign failed (${signRes.status}) ${txt}`.trim() });
          continue;
        }

        const signed = await signRes.json().catch(() => null);
        const uploadUrl = signed?.uploadUrl as string | undefined;

        if (!uploadUrl) {
          results.push({ name: file.name, ok: false, message: "sign failed (missing uploadUrl)" });
          continue;
        }

        // 2) Upload to S3 via presigned URL
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "content-type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!putRes.ok) {
          results.push({ name: file.name, ok: false, message: `upload failed (${putRes.status})` });
          continue;
        }

        results.push({ name: file.name, ok: true });
      } catch (e: any) {
        results.push({ name: file.name, ok: false, message: e?.message ?? "upload failed" });
      }
    }

    setUploadResults(results);

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;

    setStatus(failCount === 0 ? `Uploaded ${okCount}/${results.length} successfully.` : `Uploaded ${okCount}/${results.length}. ${failCount} failed.`);

    setUploading(false);

    // Refresh files list if you're currently viewing the same category
    if (viewCode && activeCategory && safeEq(activeCategory, uploadCategory)) {
      // trigger reload by resetting activeCategory briefly
      const current = activeCategory;
      setActiveCategory(null);
      setTimeout(() => setActiveCategory(current), 0);
    }
  };

  function safeEq(a: string, b: string) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  }

  return (
    <div className="w-full">
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* View */}
          <div>
            <label className="text-sm font-medium">View code</label>
            <div className="mt-1 flex gap-2">
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={viewCodeInput}
                onChange={(e) => setViewCodeInput(e.target.value)}
                placeholder="Enter view code"
              />
              <button onClick={onUnlockView} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
                Unlock
              </button>
            </div>
            <div className="mt-1 text-xs text-gray-500">Unlocks the document list and downloads.</div>
            {viewUnlocked && <div className="mt-2 text-sm font-semibold text-green-600">✅ View enabled</div>}
          </div>

          {/* Upload */}
          <div>
            <label className="text-sm font-medium">Upload code</label>
            <div className="mt-1 flex gap-2">
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={uploadCode}
                onChange={(e) => setUploadCode(e.target.value)}
                placeholder="Enter upload code"
              />
              <button onClick={onEnableUpload} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
                Enable Upload
              </button>
            </div>
            <div className="mt-1 text-xs text-gray-500">Upload unlocks only after server verification.</div>
            {uploadUnlocked && <div className="mt-2 text-sm font-semibold text-green-600">✅ Upload enabled</div>}

            {/* Multi-file upload UI */}
            <div className="mt-3 rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold">Category</span>
                <select
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  disabled={!uploadUnlocked || uploading}
                >
                  {(categories.length ? categories : ["Regulatory", "Technical", "Marketing", "Training", "General"]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="file"
                multiple
                disabled={!uploadUnlocked || uploading}
                onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm"
              />

              <button
                onClick={onUploadFiles}
                disabled={!uploadUnlocked || uploading || selectedFiles.length === 0}
                className="mt-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {uploading ? "Uploading…" : `Upload ${selectedFiles.length || ""}`.trim()}
              </button>

              {uploadResults.length > 0 && (
                <div className="mt-2 text-sm">
                  {uploadResults.map((r) => (
                    <div key={r.name} className={r.ok ? "text-green-700" : "text-red-700"}>
                      {r.ok ? "✅" : "❌"} {r.name} {r.message ? `— ${r.message}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {status && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
            {status}
          </div>
        )}
      </div>

      {/* Categories + Files */}
      {viewUnlocked && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="mb-2 text-sm font-bold">Categories</div>
            {loadingCats ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : categories.length === 0 ? (
              <div className="text-sm text-gray-500">No categories.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {categories.map((c) => {
                  const active = c === activeCategory;
                  return (
                    <button
                      key={c}
                      onClick={() => setActiveCategory(c)}
                      className={[
                        "rounded-lg border px-3 py-2 text-left text-sm font-semibold",
                        active ? "border-black bg-black text-white" : "border-gray-200 bg-white text-black",
                      ].join(" ")}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 p-3">
            <div className="mb-2 text-sm font-bold">
              Files {activeCategory ? <span className="text-gray-500">— {activeCategory}</span> : null}
            </div>

            {loadingFiles ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : !activeCategory ? (
              <div className="text-sm text-gray-500">Select a category.</div>
            ) : files.length === 0 ? (
              <div className="text-sm text-gray-500">No files found.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {files.map((f) => (
                  <div key={f.key} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <div className="text-sm font-semibold">{prettyFileName(f.name)}</div>
                    <a
                      className="rounded-lg border border-black px-3 py-1 text-sm font-bold"
                      href={`/api/docs/download?key=${encodeURIComponent(f.key)}&code=${encodeURIComponent(viewCode ?? "")}`}
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}