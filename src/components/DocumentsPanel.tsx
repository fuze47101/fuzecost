"use client";

import React, { useEffect, useMemo, useState } from "react";

type CategoriesResponse = { categories: string[] };
type FilesResponse = { files: { key: string; name: string }[] };

function normalizeCategoriesPayload(data: any): string[] {
  // Accept a few shapes so we never silently fail:
  // 1) { categories: string[] }
  // 2) string[]
  if (Array.isArray(data)) return data.filter((x) => typeof x === "string");
  if (data && Array.isArray(data.categories)) return data.categories.filter((x: any) => typeof x === "string");
  return [];
}

export default function DocumentsPanel() {
  // ---- Gate states ----
  const [viewCode, setViewCode] = useState("");
  const [uploadCode, setUploadCode] = useState("");

  const [viewUnlocked, setViewUnlocked] = useState(false);
  const [uploadUnlocked, setUploadUnlocked] = useState(false);

  // ---- Data ----
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [files, setFiles] = useState<{ key: string; name: string }[]>([]);

  // ---- Status ----
  const [status, setStatus] = useState<string>("");
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const canView = useMemo(() => viewUnlocked === true, [viewUnlocked]);

  // ---- View unlock (local; matches your current UI behavior) ----
  const onUnlockView = () => {
    if (viewCode.trim().toLowerCase() === "fuze2026") {
      setViewUnlocked(true);
      setStatus("");
    } else {
      setViewUnlocked(false);
      setCategories([]);
      setActiveCategory(null);
      setFiles([]);
      setStatus("Invalid view code.");
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
      // accept { ok: true } or { valid: true } patterns
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

  // ---- Load categories when view unlocked ----
  useEffect(() => {
    if (!canView) return;

    let cancelled = false;

    async function run() {
      setLoadingCats(true);
      setStatus("");

      try {
        const res = await fetch("/api/docs/categories", { cache: "no-store" });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`categories request failed (${res.status}) ${txt}`.trim());
        }

        const raw = await res.json().catch(() => null);
        const list = normalizeCategoriesPayload(raw);

        if (cancelled) return;

        setCategories(list);

        if (!activeCategory && list.length > 0) {
          setActiveCategory(list[0]);
        }

        if (list.length === 0) {
          setStatus("No categories found.");
        }
      } catch (e: any) {
        if (cancelled) return;
        setCategories([]);
        setActiveCategory(null);
        setFiles([]);
        setStatus(e?.message ?? "Failed to load categories.");
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // activeCategory intentionally not a dependency here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  // ---- Load files when category changes ----
  useEffect(() => {
    if (!canView) return;
    if (!activeCategory) {
      setFiles([]);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoadingFiles(true);
      setStatus("");

      try {
        const url = `/api/docs/files?category=${encodeURIComponent(activeCategory)}`;
        const res = await fetch(url, { cache: "no-store" });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`files request failed (${res.status}) ${txt}`.trim());
        }

        const data = (await res.json().catch(() => null)) as FilesResponse | any;
        const list = Array.isArray(data?.files) ? data.files : [];

        if (cancelled) return;
        setFiles(
          list
            .filter((x: any) => x && typeof x.key === "string" && typeof x.name === "string")
            .map((x: any) => ({ key: x.key, name: x.name }))
        );
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
  }, [canView, activeCategory]);

  // ---- Minimal styling (Tailwind classes are fine, but keep it predictable) ----
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
                value={viewCode}
                onChange={(e) => setViewCode(e.target.value)}
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
      {canView && (
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
                    <div className="text-sm font-semibold">{f.name}</div>
                    {/* If you have a download endpoint, this will work. If not, we add it next. */}
                    <a
                      className="rounded-lg border border-black px-3 py-1 text-sm font-bold"
                      href={`/api/docs/download?key=${encodeURIComponent(f.key)}`}
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