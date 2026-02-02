"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { calcQuote, type CostAdder, type WidthUnit } from "@/lib/calc";
import {
  calcBathDilution,
  calcDoseToStock,
  calcTargetBathFromPickup,
  type PickupMode,
} from "@/lib/dilution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { perfCharts, recommendedDose } from "@/lib/performance";

const displayFx = (currency: string, fx: number) => (currency === "USD" ? 1 : fx);

function money(n: number, currency: string) {
  if (!Number.isFinite(n)) {
    return currency === "USD" ? "$0.00" : `${currency} 0.00`;
  }

  if (currency === "USD") {
    return n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });
  }

  // For non-USD: show ISO code + numeric value (no $ symbol)
  return `${currency} ${n.toFixed(2)}`;
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
  // ===== Quote =====
  const [gsm, setGsm] = useState(150);
  const [priceUnit, setPriceUnit] = useState<"meter" | "yard">("meter");
  const [currency, setCurrency] = useState<"USD"|"CNY"|"TWD"|"VND"|"PKR"|"INR"|"LKR"|"BDT">("USD");
  const [fxToLocal, setFxToLocal] = useState<number>(1); // 1 USD = fxToLocal local currency units
  const [fxText, setFxText] = useState<string>("1");
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

  // ===== Dilution =====
  const [bathVolume, setBathVolume] = useState(200);

  // Square 1: explicit bath concentration
  const [targetBathPpm, setTargetBathPpm] = useState(3); // ppm ≈ mg/L
  const bath = useMemo(
    () => calcBathDilution({ bathVolumeLiters: bathVolume, targetMgPerL: targetBathPpm, stockMgPerL: 30 }),
    [bathVolume, targetBathPpm]
  );

  // Square 2: dose → stock liters (material required)
  const [fabricKg, setFabricKg] = useState(100);
  const [doseMgPerKg, setDoseMgPerKg] = useState(1.0);
  const doseToStock = useMemo(
    () => calcDoseToStock({ fabricKg, doseMgPerKg, stockMgPerL: 30 }),
    [fabricKg, doseMgPerKg]
  );

  // Square 3: pickup → required bath concentration, plus recipe at current bath volume
  const [pickupMode, setPickupMode] = useState<PickupMode>("dry-to-wet");
  const [pickupPercent, setPickupPercent] = useState(80); // dry-to-wet
  const [incrementalPickupPercent, setIncrementalPickupPercent] = useState(15); // wet-on-wet
  const pickupCalc = useMemo(() => {
    return calcTargetBathFromPickup({
      doseMgPerKg,
      mode: pickupMode,
      pickupPercent,
      incrementalPickupPercent,
    });
  }, [doseMgPerKg, pickupMode, pickupPercent, incrementalPickupPercent]);

  const pickupRecipe = useMemo(() => {
    return calcBathDilution({
      bathVolumeLiters: bathVolume,
      targetMgPerL: pickupCalc.requiredMgPerL,
      stockMgPerL: 30,
    });
  }, [bathVolume, pickupCalc.requiredMgPerL]);

  // ===== Docs (access code + presigned links) =====
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
    } catch {
      setDocsError("Network error loading documents.");
      setDocsLoading(false);
    }
  }

  // auto-load if code saved this browser session
  if (typeof window !== "undefined") {
    const saved = sessionStorage.getItem("docsCode");
    if (saved && docs.length === 0 && !docsLoading && !docsError) {
      fetchDocs(saved);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-neutral-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-neutral-900 px-3 py-2 inline-flex shadow-sm"><Image src="/fuze-logo.jpg" alt="FUZE" width={140} height={40} priority /></div>
            <div className="text-sm text-neutral-500">
              FUZE Metamaterial tools • F1 quoting & process reference
            </div>
          </div>
          <div className="text-sm text-neutral-500">
            F1 stock: <span className="font-medium text-neutral-800">30 ppm</span> • Bottle:{" "}
            <span className="font-medium text-neutral-800">19 L</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Tabs defaultValue="quote">
          <TabsList>
            <TabsTrigger value="quote">Quote</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
<TabsTrigger value="dilution">Dilution</TabsTrigger>
            <TabsTrigger value="docs">Documents</TabsTrigger>
            <TabsTrigger value="faq" disabled>FAQ (next)</TabsTrigger>
                      <TabsTrigger value="faq">FAQ</TabsTrigger>
</TabsList>

          {/* ===== Quote Tab ===== */}
          <TabsContent value="quote" className="mt-6">
            {/* FX_AND_UNIT_BLOCK__FUZE */}
            <div className="mt-6">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Quote display settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-wrap gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-neutral-600">Price unit</div>
                        <div className="inline-flex rounded-xl border bg-white p-1">
                          <button
                            className={"px-3 py-1.5 text-sm rounded-lg " + (priceUnit === "meter" ? "bg-neutral-900 text-white" : "text-neutral-700")}
                            onClick={() => setPriceUnit("meter")}
                            type="button"
                          >
                            Meter
                          </button>
                          <button
                            className={"px-3 py-1.5 text-sm rounded-lg " + (priceUnit === "yard" ? "bg-neutral-900 text-white" : "text-neutral-700")}
                            onClick={() => setPriceUnit("yard")}
                            type="button"
                          >
                            Yard
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-medium text-neutral-600">Currency</div>
                        <select
                          className="h-10 rounded-xl border bg-white px-3 text-sm"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as any)}
                        >
                          <option value="USD">USD</option>
                          <option value="CNY">RMB (CNY)</option>
                          <option value="TWD">NTD (TWD)</option>
                          <option value="VND">VND</option>
                          <option value="PKR">PKR</option>
                          <option value="INR">INR</option>
                          <option value="LKR">LKR</option>
                          <option value="BDT">BDT</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-medium text-neutral-600">FX rate</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-neutral-500">1 USD =</span>
                          <input
                            type="text"
                            
                            className="h-10 w-28 rounded-xl border bg-white px-3 text-sm"
                            inputMode="decimal"
                            defaultValue="1"
                            onChange={(e) => {
                              const raw = e.target.value;
                              const cleaned = raw.replace(/[^0-9.]/g, "");
                              const parts = cleaned.split(".");
                              const normalized = parts.length <= 2 ? cleaned : (parts[0] + "." + parts.slice(1).join("")); 
                              const n = Number(normalized);
                              setFxToLocal(Number.isFinite(n) ? n : 0);
                            }}
                          />
                          <span className="text-xs text-neutral-500">{currency}</span>
                          <a
                            href="https://www.xe.com/currencyconverter/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-neutral-600 underline underline-offset-2"
                          >
                            Check XE
                          </a>
                        </div>
                      </div>
                    </div>

                    </div>

                  <div className="rounded-xl border bg-neutral-50 p-3 text-sm">
                    {(() => {
                      const perMeterUSD = outputs?.totalCostPerLinearMeter ?? NaN;
                      const perYardUSD = (isFinite(perMeterUSD) ? perMeterUSD * 0.9144 : NaN);

                      const primaryUSD = priceUnit === "meter" ? perMeterUSD : perYardUSD;
                      const secondaryUSD = priceUnit === "meter" ? perYardUSD : perMeterUSD;

                      const fx = (isFinite(fxToLocal) && fxToLocal > 0) ? fxToLocal : 1;
                      const primaryLocal = currency === "USD" ? primaryUSD : primaryUSD * fx;
                      const secondaryLocal = currency === "USD" ? secondaryUSD : secondaryUSD * fx;

                      const primaryLabel = priceUnit === "meter" ? "per linear meter" : "per yard";
                      const secondaryLabel = priceUnit === "meter" ? "per yard" : "per linear meter";

                      return (
                        <div className="space-y-1">
                          <div className="font-semibold text-neutral-900">
                             {money(primaryLocal, currency)} <span className="text-neutral-600 font-normal">{primaryLabel}</span>
                          </div>
                          <div className="text-neutral-600">
                             {money(secondaryLocal, currency)} <span className="text-neutral-500">{secondaryLabel}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* /FX_AND_UNIT_BLOCK__FUZE */}

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
                        <Button type="button" variant={widthUnit === "in" ? "default" : "outline"} onClick={() => setWidthUnit("in")} className="flex-1">Inches</Button>
                        <Button type="button" variant={widthUnit === "m" ? "default" : "outline"} onClick={() => setWidthUnit("m")} className="flex-1">Meters</Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Fabric width ({widthUnit === "in" ? "in" : "m"})</Label>
                    <Input type="number" value={width} min={0} step="0.01" onChange={(e) => setWidth(Number(e.target.value))} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Target F1 add-on (mg/kg)</Label>
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
                      <Label>F1 price ($/L)</Label>
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
                      {money((outputs.totalCostPerLinearMeter * displayFx(currency, fxToLocal)), currency)}{" "}
                      <span className="text-base font-medium text-neutral-500">/ m</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="text-4xl font-semibold tracking-tight">
                        {money(
                          (priceUnit === "meter"
                            ? outputs.totalCostPerLinearMeter * 0.9144
                            : outputs.totalCostPerLinearMeter) * displayFx(currency, fxToLocal),
                          currency
                        )}{" "}
                        <span className="text-lg font-normal text-neutral-600">/ {priceUnit === "meter" ? "yd" : "m"}</span>
                      </div>

                      <div className="text-4xl font-semibold tracking-tight">
                        {(() => {
                          const unitCostPerM =
                            outputs.totalCostPerLinearMeter * displayFx(currency, fxToLocal);
                          const kgPerM = outputs.kgPerLinearMeter || 0;
                          const perKg = kgPerM > 0 ? unitCostPerM / kgPerM : 0;
                          return money(perKg, currency);
                        })()}{" "}
                        <span className="text-lg font-normal text-neutral-600">/ kg</span>
                      </div>

                      <div className="text-4xl font-semibold tracking-tight">
                        {(() => {
                          const unitCostPerM =
                            outputs.totalCostPerLinearMeter * displayFx(currency, fxToLocal);
                          const kgPerM = outputs.kgPerLinearMeter || 0;
                          const lbPerM = kgPerM * 2.2046226218;
                          const perLb = lbPerM > 0 ? unitCostPerM / lbPerM : 0;
                          return money(perLb, currency);
                        })()}{" "}
                        <span className="text-lg font-normal text-neutral-600">/ lb</span>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-neutral-600">
                      F1: <span className="font-medium">{money((outputs.fuzeCostPerLinearMeter * displayFx(currency, fxToLocal)), currency)}/m</span> • Adders:{" "}
                      <span className="font-medium">{money((outputs.addersPerLinearMeter * displayFx(currency, fxToLocal)), currency)}/m</span>
                    </div>
                  </div>
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
                    <div className="text-sm text-neutral-500">Recipe result (F1 stock at 30 ppm)</div>
                    <div className="text-sm mt-2">
                      F1 stock: <span className="font-medium">{num(bath.stockLiters, 4)} L</span>
                    </div>
                    <div className="text-sm">
                      Water: <span className="font-medium">{num(bath.waterLiters, 4)} L</span>
                    </div>
                    <div className="text-sm">
                      Bottles (19 L): <span className="font-medium">{bath.bottles19L}</span>
                    </div>
                  </div>

                  
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader><CardTitle>From dose (mg/kg) → F1 stock needed</CardTitle></CardHeader>
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
                      Total F1 required: <span className="font-medium">{num(doseToStock.totalF1MgNeeded, 3)} mg</span>
                    </div>
                    <div className="text-sm">
                      F1 stock (30 ppm): <span className="font-medium">{num(doseToStock.stockLitersNeeded, 4)} L</span>
                    </div>
                    <div className="text-sm">
                      Bottles (19 L): <span className="font-medium">{doseToStock.bottles19L}</span>
                    </div>
                  </div>

                  
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm lg:col-span-2">
                <CardHeader><CardTitle>Pickup → required bath concentration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Target add-on (mg/kg)</Label>
                      <Input type="number" value={doseMgPerKg} min={0} step="0.01" onChange={(e) => setDoseMgPerKg(Number(e.target.value))} />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Process mode</Label>
                      <div className="flex gap-2">
                        <Button type="button" className="flex-1" variant={pickupMode === "dry-to-wet" ? "default" : "outline"} onClick={() => setPickupMode("dry-to-wet")}>
                          Dry-to-wet
                        </Button>
                        <Button type="button" className="flex-1" variant={pickupMode === "wet-on-wet" ? "default" : "outline"} onClick={() => setPickupMode("wet-on-wet")}>
                          Wet-on-wet
                        </Button>
                      </div>
                    </div>
                  </div>

                  {pickupMode === "dry-to-wet" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Pickup (%)</Label>
                        <Input type="number" value={pickupPercent} min={0} step="1" onChange={(e) => setPickupPercent(Number(e.target.value))} />
                      </div>
                      <div className="text-xs text-neutral-500 flex items-end">
                        Pickup on dry fabric basis (example: 80%).
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Incremental pickup (%)</Label>
                        <Input type="number" value={incrementalPickupPercent} min={0} step="1" onChange={(e) => setIncrementalPickupPercent(Number(e.target.value))} />
                      </div>
                      <div className="text-xs text-neutral-500 flex items-end">
                        Wet-on-wet incremental pickup on dry basis (example: +15%).
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm text-neutral-500">Pickup (L/kg)</div>
                      <div className="text-xl font-semibold">{num(pickupCalc.pickupFractionLperKg, 4)}</div>
                      <div className="text-xs text-neutral-500 mt-1">{pickupCalc.note}</div>
                    </div>

                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm text-neutral-500">Required bath ppm</div>
                      <div className="text-xl font-semibold">{num(pickupCalc.requiredMgPerL, 4)}</div>
                      <div className="text-xs text-neutral-500 mt-1">ppm ≈ mg/L</div>
                    </div>

                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm text-neutral-500">Also shown as g/L</div>
                      <div className="text-xl font-semibold">{num(pickupCalc.requiredGPerL, 6)}</div>
                      <div className="text-xs text-neutral-500 mt-1">g/L = (mg/L) ÷ 1000</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm text-neutral-500">Recipe for current bath volume ({bathVolume} L)</div>
                    <div className="text-sm mt-2">
                      Target ppm: <span className="font-medium">{num(pickupCalc.requiredMgPerL, 4)}</span> • F1 stock:{" "}
                      <span className="font-medium">{num(pickupRecipe.stockLiters, 4)} L</span> • Water:{" "}
                      <span className="font-medium">{num(pickupRecipe.waterLiters, 4)} L</span> • Bottles (19 L):{" "}
                      <span className="font-medium">{pickupRecipe.bottles19L}</span>
                    </div>
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
                  <Input placeholder="Access code" value={docsCode} onChange={(e) => setDocsCode(e.target.value)} />
                  <Button onClick={() => fetchDocs(docsCode)} disabled={docsLoading || !docsCode}>
                    {docsLoading ? "Loading…" : "Unlock"}
                  </Button>
                </div>

                {docsError && <div className="text-sm text-red-600">{docsError}</div>}

                {docs.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {docs.map((d) => (
                      <div key={d.id} className="rounded-2xl border bg-white p-4">
                        
                        <div className="font-semibold">{d.title}</div>
                        {d.note && <div className="text-sm text-neutral-600 mt-1">{d.note}</div>}
                        <div className="mt-3">
                          <a href={d.url} className="inline-flex items-center rounded-xl border px-3 py-2 text-sm font-medium hover:bg-neutral-50">
                            Download
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs text-neutral-500 pt-2">
                  Downloads are time-limited signed links. If a link expires, unlock again.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="mt-6">
            <div className="grid grid-cols-1 gap-6">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Application level vs expected performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-700 space-y-2">
                    <div className="font-semibold">Recommendation & caveats (FUZE F1 / FUZE Metamaterial)</div>
                    <p>
                      FUZE recommends <span className="font-medium">1.0 mg/kg</span> (weight of fabric) applications for premium performance and up to and over 100 wash durability
                      targets when applied to specification. This level helps penetrate sacrificial finishing chemistries applied to the textile and helps achieve permanent bonding directly
                      to the fiber. This level also helps overcome deficiencies in manufacturing equipment and factory precision.
                    </p>
                    <p>
                      FUZE performance on cotton often outperforms synthetics at the same application levels due to natural fiber construction.
                      Levels at and above 1.0 mg/kg are also recommended for enhanced ancillary features and benefits of a FUZE treatment, such as reduced drying time,
                      better moisture transport, improved color fastness, and fiber protection — which typically improve at higher application levels.
                    </p>
                    <p>
                      The 1.0 mg/kg application level receives FUZE certification, enhanced testing, and coordinated marketing.
                      Validation is performed in approved labs using high definition ICP-MS instruments (see FAQ for additional detail on ICP validation and analysis).
                    </p>
                    <p className="text-xs text-neutral-500">
                      Competitive note: FUZE Metamaterial is differentiated from legacy leaching metal-based antimicrobials by its permanent integration approach and validated performance profile.
                    </p>
                    <div className="mt-4 rounded-2xl border bg-white p-4">
                      <div className="font-semibold text-sm text-neutral-800">Application efficiency (visual)</div>
                      <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                        <div className="text-sm text-neutral-700 space-y-2">
                          <p>
                            At <span className="font-medium">0.5 mg/kg</span>, the applied amount is comparable to only a few grains of table salt distributed across
                            <span className="font-medium"> 1 kg (2.2 lb)</span> of fabric — a practical illustration of the precision and efficiency of the FUZE Metamaterial.
                          </p>
                          <p className="text-xs text-neutral-500">
                            Visual analogy for scale (not a lab equivalency). Confirm application with ICP-MS validation.
                          </p>
                        </div>
                        <div className="rounded-2xl border bg-neutral-950 p-2">
                          <img
                            src="/salt-to-weight.svg"
                            alt="Illustration: a few grains of salt compared to 1 kg fabric at 0.5 mg/kg add-on"
                            className="w-full h-auto rounded-xl"
                          />
                        </div>
                      </div>
                    </div>

                  </div>

                  {(() => {
                    const selectedDose = recommendedDose(dose);
                    const families = [
                      { key: "synthetics", data: perfCharts.synthetics },
                      { key: "cotton", data: perfCharts.cotton },
                      { key: "blends", data: perfCharts.blends },
                    ] as const;

                    const pill = (text: string) => (
                      <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium text-neutral-700 bg-neutral-50">
                        {text}
                      </span>
                    );

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {families.map((f) => (
                          <div key={f.key} className="rounded-2xl border bg-white p-4">
                            <div className="font-semibold">{f.data.title}</div>
                            <div className="text-xs text-neutral-500 mt-1">{f.data.subtitle}</div>

                            <div className="mt-3 space-y-2">
                              {f.data.points.map((pt) => {
                                const active = pt.mgPerKg === selectedDose;
                                return (
                                  <div
                                    key={pt.mgPerKg}
                                    className={
                                      "rounded-xl border px-3 py-2 space-y-2 " +
                                      (active ? "border-neutral-900 bg-neutral-50" : "border-neutral-200")
                                    }
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="text-sm font-medium">
                                        {pt.mgPerKg.toFixed(2)} mg/kg
                                      </div>
                                      {active && (
                                        <div className="text-xs font-semibold rounded-full bg-neutral-900 text-white px-2 py-1">
                                          Recommended
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      {pill("Antimicrobial: " + pt.antimicrobial)}
                                      {pill("Wash durability: " + pt.washDurability)}
                                    </div>

                                    <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1">
                                      {pt.notes.map((n) => (
                                        <li key={n}>{n}</li>
                                      ))}
                                    </ul>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          
<TabsContent value="faq" className="mt-6">
  <Card className="rounded-2xl shadow-sm">
    <CardHeader>
      <CardTitle className="text-2xl font-semibold">FAQ</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6 text-sm leading-relaxed">

      <div>
        <div className="font-medium">Is FUZE a permanent antimicrobial treatment?</div>
        <div className="mt-1 pl-4 text-neutral-700">
          Yes. FUZE is permanently integrated into the textile fiber and does not leach, wash out, or rely on ion release.
          Performance remains for the life of the fabric.
        </div>
      </div>

      <div>
        <div className="font-medium">Why does FUZE perform differently than traditional silver technologies?</div>
        <div className="mt-1 pl-4 text-neutral-700">
          Conventional technologies rely on high concentrations of leaching metal ions to pass short-duration laboratory tests.
          FUZE is non-ionic and non-leaching, designed for permanent effectiveness rather than depletion-based performance.
        </div>
      </div>

      <div>
        <div className="font-medium">Why does lower application still show effectiveness?</div>
        <div className="mt-1 pl-4 text-neutral-700">
          FUZE effectiveness is mathematically driven by time-to-contact (TTC). Lower application levels increase TTC,
          but still fully inhibit bacterial growth, odor formation, and propagation over time.
        </div>
      </div>

      <div>
        <div className="font-medium">How should antimicrobial test results be interpreted?</div>
        <div className="mt-1 pl-4 text-neutral-700">
          Standard antimicrobial tests are timed. FUZE may show reduced instantaneous kill at lower doses,
          while still completely preventing regrowth and odor formation over real-world use cycles.
        </div>
      </div>

      <div>
        <div className="font-medium">Why does FUZE often outperform synthetics on cotton?</div>
        <div className="mt-1 pl-4 text-neutral-700">
          Cotton’s natural fiber structure allows deeper integration and more uniform bonding of FUZE,
          often producing superior durability compared to synthetic fibers at equivalent application levels.
        </div>
      </div>

      <div>
        <div className="font-medium">How small is a 0.5 mg/kg application?</div>
        <div className="mt-1 pl-4 text-neutral-700">
          A 0.5 mg/kg application is equivalent to approximately two grains of table salt distributed across
          one kilogram (2.2 lb) of fabric — highlighting FUZE’s efficiency, safety, and precision.
        </div>
      </div>

      <div>
        <div className="font-medium">How is FUZE validated?</div>
        <div className="mt-1 pl-4 text-neutral-700">
          All FUZE validation is performed in approved laboratories using high-definition ICP-MS instrumentation
          alongside antimicrobial and durability testing.
        </div>
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
