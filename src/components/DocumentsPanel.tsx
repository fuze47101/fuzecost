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
    .filter(
      (x: any) =>
        x && typeof x.key === "string" && typeof x.name === "string"
    )
    .map((x: any) => ({ key: x.key, name: x.name }));
}

/**
 * User-friendly display name (frontend-only)
 * Keeps S3 keys intact for download
 */
function prettyFileName(raw: string) {
  // Remove leading hex/hash prefix + dash
  let name = raw.replace(/^[a-f0-9]{8,}-/i, "");

  // Replace underscores and dashes with spaces
  name = name.replace(/[_-]+/g, " ");

  // Collapse extra spaces
  name = name.replace(/\s+/g, " ").trim();

  return name;
}

export default function DocumentsPanel() {
  // Inputs
  const [viewCodeInput, setViewCodeInput] = useState("");
  const [uploadCode, setUploadCode] = useState("");

  // View gate (set only after server accepts code)
  const [viewCode, setViewCode] = useState<string | null>(null);
  const [uploadUnlocked, setUploadUnlocked] = useState(false);

  // Data
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [files, setFiles] = useState<{ key: string; name: string }[]>([]);

  // UI state
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

  // ---- Upload unlock ----
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

      setUploadUnlocked(true);
      setStatus("Upload enabled.");
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
        const res = await fetch(
          `/api/docs/files?category=${encodeURIComponent(category)}`,
          { cache: "no-store", headers: viewHeaders(code) }
        );

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
            {viewUnlocked && (
              <div className="mt-2 text-sm font-semibold text-green-600">
                ✅ View enabled
              </div>
            )}
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
            {uploadUnlocked && (
              <div className="mt-2 text-sm font-semibold text-green-600">
                ✅ Upload enabled
              </div>
            )}
          </div>
        </div>

        {status && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            {status}
          </div>
        )}
      </div>

      {/* Categories + Files */}
      {viewUnlocked && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="mb-2 text-sm font-bold">Categories</div>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={[
                  "mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold",
                  c === activeCategory
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 p-3">
            <div className="mb-2 text-sm font-bold">
              Files {activeCategory && `— ${activeCategory}`}
            </div>

            {loadingFiles ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : files.length === 0 ? (
              <div className="text-sm text-gray-500">No files found.</div>
            ) : (
              files.map((f) => (
                <div
                  key={f.key}
                  className="mb-2 flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="text-sm font-semibold">
                    {prettyFileName(f.name)}
                  </div>
                  <a
                    href={`/api/docs/download?key=${encodeURIComponent(
                      f.key
                    )}&code=${encodeURIComponent(viewCode ?? "")}`}
                    className="rounded-lg border border-black px-3 py-1 text-sm font-bold"
                  >
                    Download
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}