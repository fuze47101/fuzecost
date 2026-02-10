"use client";

import React, { useEffect, useMemo, useState } from "react";

type FilesResponse = { files: { key: string; name: string }[] };

function normalizeCategoriesPayload(data: any): string[] {
  if (Array.isArray(data)) return data.filter((x) => typeof x === "string");
  if (data && Array.isArray(data.categories)) return data.categories.filter((x: any) => typeof x === "string");
  return [];
}

function normalizeFilesPayload(data: any): { key: string; name: string }[] {
  if (!data || !Array.isArray(data.files)) return [];
  return data.files
    .filter((x: any) => x && typeof x.key === "string" && typeof x.name === "string")
    .map((x: any) => ({ key: x.key, name: x.name }));
}

export default function DocumentsPanel() {
  // Inputs
  const [viewCodeInput, setViewCodeInput] = useState("");
  const [uploadCode, setUploadCode] = useState("");

  // Gate: we only set this AFTER server accepts the code
  const [viewCode, setViewCode] = useState<string | null>(null);

  const [uploadUnlocked, setUploadUnlocked] = useState(false);

  // Data
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [files, setFiles] = useState<{ key: string; name: string }[]>([]);

  // UI status
  const [status, setStatus] = useState("");
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const viewUnlocked = useMemo(() => viewCode !== null, [viewCode]);

  // Helper: include view code in all docs calls
  function viewHeaders(code: string) {
    // Server is clearly expecting SOME view code signal.
    // We send it in the most common patterns so we match your backend without guessing:
    // - x-view-code header (preferred)
    // - authorization bearer (fallback)
    return {
      "x-view-code": code,
      authorization: `Bearer ${code}`,
    } as Record<string, string>;
  }

  // ---- Unlock View (SERVER VERIFIED) ----
  const onUnlockView = async () => {
    const code = viewCodeInput.trim();
    if (!code) {
      setStatus("Enter a view code.");
      setViewCode(null);
      setCategories([]);
      setActiveCategory(null);
      setFiles([]);
      return;
    }

    try {
      setStatus("Verifying view code…");
      setLoadingCats(true);

      const res = await fetch("/api/docs/categories", {
        method: "GET",
        cache: "no-store",
        headers: {
          ...viewHeaders(code),
        },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        // Lock view if server rejects
        setViewCode(null);
        setCategories([]);
        setActiveCategory(null);
        setFiles([]);
        setStatus(`categories request failed (${res.status}) ${txt}`.trim());
        return;
      }

      const raw = await res.json().catch(() => null);
      const list = normalizeCategoriesPayload(raw);

      // Server accepted the code
      setViewCode(code);
      setCategories(list);
      setActiveCategory(list.length ? list[0] : null);
      setFiles([]);
      setStatus(list.length ? "" : "No categories found.");
    } catch (e: any) {
      setViewCode(null);
      setCategories([]);
      setActiveCategory(null);
      setFiles([]);
      setStatus(e?.message ?? "Failed to verify view code.");
    } finally {
      setLoadingCats(false);
    }
  };

  // ---- Upload unlock (server verification) ----
  const onEnableUpload = async () => {
    try {
      setStatus("Verifying upload code...");
      const res = await fetch("/api/docs/sign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: uploadCode.trim(), verifyOnly: true }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setUploadUnlocked(false);
        setStatus(`Upload verify failed (${res.status}). ${txt}`.trim());
        return;
      }

      const data = await res.json().catch(() => ({}));
      const ok = Boolean((data && (data.ok || data.valid)) ?? true);

      if (ok) {
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

  // ---- Load files when category changes (requires viewCode) ----
  useEffect(() => {
    if (!viewCode) return;

    if (!activeCategory) {
      setFiles([]);
      return;
    }

    const code: string = viewCode;
    const category: string = activeCategory;

    let cancelled = false;

    async function run() {
      setLoadingFiles(true);
      setStatus("");

      try {
        const url = `/api/docs/files?category=${encodeURIComponent(category)}`;
        const res = await fetch(url, {
          cache: "no-store",
          headers: {
            ...viewHeaders(code),
          },
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`files request failed (${res.status}) ${txt}`.trim());
        }

        const data = (await res.json().catch(() => null)) as FilesResponse | any;
        const list = normalizeFilesPayload(data);

        if (cancelled) return;
        setFiles(list);
      } catch (e: any) {
        if (cancelled) return;
        setFiles([]);
        setStatus(e?.message ?? "Failed to load files.");
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [viewCode, activeCategory]);

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
              <button
                onClick={onUnlockView}
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
              >
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
              <button
                onClick={onEnableUpload}
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
              >
                Enable Upload
              </button>
            </div>
            <div className="mt-1 text-xs text-gray-500">Upload unlocks only after server verification.</div>
            {uploadUnlocked && <div className="mt-2 text-sm font-semibold text-green-600">✅ Upload enabled</div>}
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
                  <div
                    key={f.key}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <div className="text-sm font-semibold">{f.name}</div>

                    {/* Download endpoint may also require view code; we pass it as query too */}
                    <a
                      className="rounded-lg border border-black px-3 py-1 text-sm font-bold"
                      href={`/api/docs/download?key=${encodeURIComponent(f.key)}&code=${encodeURIComponent(
                        viewCode ?? ""
                      )}`}
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