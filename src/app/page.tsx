"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { calcQuote, type CostAdder, type WidthUnit } from "@/lib/calc";
import { calcBathDilution, calcDoseToStock } from "@/lib/dilution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function money(n: number) {
  if (!Number.isFinite(n)) return "$0.00";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function num(n: number, digits = 6) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function uid() {
  return Math.random().toString(16).slice(2);
}

type DocItem = {
  id: string;
  title: string;
  category: string;
  note: string;
  filename: string;
  url: string;
};

export default function Page() {
  // ===== Quote (existing) =====
  const [gsm, setGsm] = useState(150);
  const [widthUnit, setWidthUnit] = useState<WidthUnit>("in");
  const [width, setWidth] = useState(60);
  const [dose, setDose] = useState(1.0);

  const [pricePerLiter, setPricePerLiter] = useState(36);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [lengthMeters, setLengthMeters] = useState<number | "">("");

  const [adders, setAdders] = useState<CostAdder[]>([
    { id: "moq", label: "Below MOQ", centsPerMeter: 0, enabled: true },
    { id: "waste", label: "Waste in application bath", centsPerMeter: 0, enabled: true },
    { id: "process", label: "Additional processing", centsPerMeter: 0, enabled: true },
    { id: "other", label: "Other", centsPerMeter: 0, enabled: true },
  ]);

  const outputs = useMemo(() => {
    return calcQuote({
      gsm,
      width,
      widthUnit,
      doseMgPerKg: dose,
      stockMgPerL: 30,
      pricePerLiter,
      discountPercent,
      lengthMeters: typeof lengthMeters === "number" ? lengthMeters : undefined,
      adders,
    });
  }, [gsm, width, widthUnit, dose, pricePerLiter, discountPercent, lengthMeters, adders]);

  const addRow = () => {
    setAdders(prev => [
      ...prev,
      { id: uid(), label: "Custom adder", centsPerMeter: 0, enabled: true },
    ]);
  };
  const removeRow = (id: string) => setAdders(prev => prev.filter(a => a.id !== id));
  const updateAdder = (id: string, patch: Partial<CostAdder>) => {
    setAdders(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
  };

  // ===== Dilution tab =====
  const [bathVolume, setBathVolume] = useState(200);
  const [targetBathPpm, setTargetBathPpm] = useState(3); // mg/L ~ ppm
  const bath = useMemo(
    () => calcBathDilution({ bathVolumeLiters: bathVolume, targetMgPerL: targetBathPpm, stockMgPerL: 30 }),
    [bathVolume, targetBathPpm]
  );

  const [fabricKg, setFabricKg] = useState(100);
  const [doseMgPerKg, setDoseMgPerKg] = useState(1.0);
  const doseToStock = useMemo(
    () => calcDoseToStock({ fabricKg, doseMgPerKg, stockMgPerL: 30 }),
    [fabricKg, doseMgPerKg]
  );

  // ===== Docs tab (access code + presigned links) =====
  const [docsCode, setDocsCode] = useState("");
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState("");
  const [docs, setDocs] = useState<DocItem[]>([]);

  async function fetchDocs(code: string) {
    setDocsLoading(true);
    setDocsError("");
    setDocs([]);

    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const json = await res.json();
      if (!json?.ok) {
        setDocsError(json?.message || "Failed to load documents.");
        setDocsLoading(false);
        return;
      }

      setDocs(json.items || []);
      setDocsLoading(false);
      sessionStorage.setItem("docsCode", code);
    } catch (e: any) {
      setDocsError("Network error loading documents.");
      setDocsLoading(false);
    }
  }

  // attempt auto-load if they already entered a code this session
  if (typeof window !== "undefined") {
    const saved = sessionStorage.getItem("docsCode");
    if (saved && docs.length === 0 && !docsLoading && !docsError) {
      // fire and forget (no infinite loop since docsLoading flips immediately)
      fetchDocs(saved);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-neutral-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/fuze-logo.svg" alt="FUZE" width={140} height={40} priority />
            <div className="text-sm text-neutral-500">Cost, dilution & document reference</div>
          </div>
          <div className="text-sm text-neutral-500">
            Stock: <span className="font-medium text-neutral-800">30 mg/L</span> • Bottle:{" "}
            <span className="font-medium text-neutral-800">19 L</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Tabs defaultValue="quote">
          <TabsList>
            <TabsTrigger value="quote">Quote</TabsTrigger>
            <TabsTrigger value="dilution">Dilution</TabsTrigger>
            <TabsTrigger value="docs">Documents</TabsTrigger>
            <TabsTrigger value="faq" disabled>FAQ (next)</TabsTrigger>
          </TabsList>

          {/* ===== Quote Tab ===== */}
          <TabsContent value="quote" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader><CardTitle>Inputs</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Label>Fabric weight (GSM)</Label>
                      <Input type="number" value={gsm} min={0} step="1" onChange={(e) => setGsm(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>Width unit</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant={widthUnit === "in" ? "default" : "outline"} onClick={() => setWidthUnit("in")} className="w-full">Inches</Button>
                        <Button type="button" variant={widthUnit === "m" ? "default" : "outline"} onClick={() => setWidthUnit("m")} className="w-full">Meters</Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Fabric width ({widthUnit === "in" ? "in" : "m"})</Label>
                    <Input type="number" value={width} min={0} step="0.01" onChange={(e) => setWidth(Number(e.target.value))} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Target FUZE add-on (mg/kg)</Label>
                      <div className="text-sm text-neutral-600 font-medium">{dose.toFixed(2)}</div>
                    </div>
                    <Slider value={[dose]} min={0.25} max={2.0} step={0.05} onValueChange={(v) => setDose(v[0] ?? 1.0)} className="mt-2" />
                    <div className="mt-2">
                      <Label className="text-xs text-neutral-500">Or enter exact</Label>
                      <Input type="number" value={dose} min={0} step="0.01" onChange={(e) => setDose(Number(e.target.value))} />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>FUZE price ($/L)</Label>
                      <Input type="number" value={pricePerLiter} min={0} step="0.01" onChange={(e) => setPricePerLiter(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>Customer discount (%)</Label>
                      <Input type="number" value={discountPercent} min={0} max={100} step="0.5" onChange={(e) => setDiscountPercent(Number(e.target.value))} />
                    </div>
                  </div>

                  <div>
                    <Label>Optional: job length (meters)</Label>
                    <Input
                      type="number"
                      value={lengthMeters}
                      min={0}
                      step="1"
                      onChange={(e) => {
                        const v = e.target.value;
                        setLengthMeters(v === "" ? "" : Number(v));
                      }}
                      placeholder="Enter to calculate total liters and bottle count"
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">Factory adders (¢ / linear meter)</div>
                        <div className="text-sm text-neutral-500">Added costs reported by the factory.</div>
                      </div>
                      <Button type="button" variant="outline" onClick={addRow}>+ Add row</Button>
                    </div>

                    <div className="space-y-3">
                      {adders.map((a) => (
                        <div key={a.id} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-1">
                            <input type="checkbox" checked={a.enabled} onChange={(e) => updateAdder(a.id, { enabled: e.target.checked })} className="h-4 w-4" />
                          </div>
                          <div className="col-span-6">
                            <Input value={a.label} onChange={(e) => updateAdder(a.id, { label: e.target.value })} />
                          </div>
                          <div className="col-span-4">
                            <Input type="number" value={a.centsPerMeter} step="1" onChange={(e) => updateAdder(a.id, { centsPerMeter: Number(e.target.value) })} />
                          </div>
                          <div className="col-span-1">
                            <Button type="button" variant="ghost" onClick={() => removeRow(a.id)} title="Remove row">✕</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader><CardTitle>Quote</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-2xl border bg-white p-5">
                    <div className="text-sm text-neutral-500">Total quoted cost</div>
                    <div className="text-4xl font-semibold mt-1">
                      {money(outputs.totalCostPerLinearMeter)}{" "}
                      <span className="text-base font-medium text-neutral-500">/ m</span>
                    </div>
                    <div className="mt-3 text-sm text-neutral-600">
                      FUZE: <span className="font-medium">{money(outputs.fuzeCostPerLinearMeter)}/m</span> • Adders:{" "}
                      <span className="font-medium">{money(outputs.addersPerLinearMeter)}/m</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm text-neutral-500">Fabric mass</div>
                      <div className="text-xl font-semibold">{num(outputs.kgPerLinearMeter, 8)} kg / m</div>
                      <div className="text-xs text-neutral-500 mt-1">Width = {num(outputs.widthMeters, 4)} m</div>
                    </div>
                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm text-neutral-500">FUZE required</div>
                      <div className="text-xl font-semibold">{num(outputs.mgPerLinearMeter, 8)} mg / m</div>
                      <div className="text-xs text-neutral-500 mt-1">{num(outputs.litersStockPerLinearMeter, 10)} L stock / m</div>
                    </div>
                  </div>

                  {typeof outputs.totalLitersStock === "number" && typeof outputs.bottles19L === "number" && (
                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm text-neutral-500">Job totals</div>
                      <div className="text-sm mt-1">Total stock: <span className="font-medium">{num(outputs.totalLitersStock, 3)} L</span></div>
                      <div className="text-sm">Bottles (19 L): <span className="font-medium">{outputs.bottles19L}</span></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== Dilution Tab ===== */}
          <TabsContent value="dilution" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader><CardTitle>Bath dilution (target ppm in bath)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Bath volume (L)</Label>
                    <Input type="number" value={bathVolume} min={0} step="1" onChange={(e) => setBathVolume(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Target concentration (ppm ≈ mg/L)</Label>
                    <Input type="number" value={targetBathPpm} min={0} step="0.1" onChange={(e) => setTargetBathPpm(Number(e.target.value))} />
                  </div>

                  <Separator />

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm text-neutral-500">Recipe result</div>
                    <div className="text-sm mt-2">
                      FUZE stock (30 mg/L): <span className="font-medium">{num(bath.stockLiters, 4)} L</span>
                    </div>
                    <div className="text-sm">
                      Water: <span className="font-medium">{num(bath.waterLiters, 4)} L</span>
                    </div>
                    <div className="text-sm">
                      Bottles (19 L): <span className="font-medium">{bath.bottles19L}</span>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-500">
                    Uses C1V1=C2V2. This is for setting bath concentration; add-on dosing depends on pickup/process.
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader><CardTitle>From dose (mg/kg) → stock liters needed</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Fabric weight processed (kg)</Label>
                    <Input type="number" value={fabricKg} min={0} step="1" onChange={(e) => setFabricKg(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Target add-on (mg/kg)</Label>
                    <Input type="number" value={doseMgPerKg} min={0} step="0.01" onChange={(e) => setDoseMgPerKg(Number(e.target.value))} />
                  </div>

                  <Separator />

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm text-neutral-500">Result</div>
                    <div className="text-sm mt-2">
                      Total silver required: <span className="font-medium">{num(doseToStock.totalMgNeeded, 3)} mg</span>
                    </div>
                    <div className="text-sm">
                      FUZE stock (30 mg/L): <span className="font-medium">{num(doseToStock.stockLitersNeeded, 4)} L</span>
                    </div>
                    <div className="text-sm">
                      Bottles (19 L): <span className="font-medium">{doseToStock.bottles19L}</span>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-500">
                    This is a “material required” calculator. Converting to bath ppm needs pickup / liquor ratio (we can add next).
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== Docs Tab ===== */}
          <TabsContent value="docs" className="mt-6">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader><CardTitle>Document repository</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-neutral-500">
                  Enter the access code to view and download commonly requested documents (SDS, EPA, labels, SOPs).
                </div>

                <div className="flex gap-2 max-w-lg">
                  <Input
                    placeholder="Access code"
                    value={docsCode}
                    onChange={(e) => setDocsCode(e.target.value)}
                  />
                  <Button
                    onClick={() => fetchDocs(docsCode)}
                    disabled={docsLoading || !docsCode}
                  >
                    {docsLoading ? "Loading…" : "Unlock"}
                  </Button>
                </div>

                {docsError && (
                  <div className="text-sm text-red-600">{docsError}</div>
                )}

                {docs.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {docs.map((d) => (
                      <div key={d.id} className="rounded-2xl border bg-white p-4">
                        <div className="text-xs text-neutral-500">{d.category}</div>
                        <div className="font-semibold">{d.title}</div>
                        {d.note && <div className="text-sm text-neutral-600 mt-1">{d.note}</div>}
                        <div className="mt-3">
                          <a
                            href={d.url}
                            className="inline-flex items-center rounded-xl border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs text-neutral-500 pt-2">
                  Downloads are time-limited signed links. If a link expires, just unlock again.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="px-6 py-10 text-center text-sm text-neutral-500">
        © {new Date().getFullYear()} FUZE • Tools are estimates; factory conditions may change results.
      </footer>
    </div>
  );
}
