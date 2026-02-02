export type WidthUnit = "in" | "m";

export type CostAdder = {
  id: string;
  label: string;
  // cents per linear meter
  centsPerMeter: number;
  enabled: boolean;
};

export type CalcInputs = {
  gsm: number;
  width: number;
  widthUnit: WidthUnit;
  doseMgPerKg: number;

  stockMgPerL: number;   // 30 mg/L
  pricePerLiter: number; // default 36
  discountPercent: number;

  lengthMeters?: number;
  adders: CostAdder[];
};

export type CalcOutputs = {
  widthMeters: number;
  kgPerLinearMeter: number;
  mgPerLinearMeter: number;
  litersStockPerLinearMeter: number;

  effectivePricePerLiter: number;
  fuzeCostPerLinearMeter: number;

  addersPerLinearMeter: number;
  totalCostPerLinearMeter: number;

  totalLitersStock?: number;
  bottles19L?: number;
};

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}


export function widthToMeters(width: number, unit: WidthUnit) {
  const w = Number(width) || 0;
  return unit === "in" ? w * 0.0254 : w;
}


const YARDS_PER_METER = 1.0936132983377078;
const METERS_PER_YARD = 0.9144;

export function calcQuote(inputs: CalcInputs): CalcOutputs {
  const gsm = Math.max(0, Number(inputs.gsm) || 0);
  const widthMeters = Math.max(0, widthToMeters(inputs.width, inputs.widthUnit));
  const doseMgPerKg = Math.max(0, Number(inputs.doseMgPerKg) || 0);

  const stockMgPerL = Math.max(0.000001, Number(inputs.stockMgPerL) || 30);
  const pricePerLiter = Math.max(0, Number(inputs.pricePerLiter) || 0);
  const discountPercent = clamp(Number(inputs.discountPercent) || 0, 0, 100);

  const effectivePricePerLiter = pricePerLiter * (1 - discountPercent / 100);

  // kg per linear meter = GSM * width(m) / 1000
  const kgPerLinearMeter = (gsm * widthMeters) / 1000;

  // mg per linear meter = dose(mg/kg) * kg/m
  const mgPerLinearMeter = doseMgPerKg * kgPerLinearMeter;

  // liters stock per linear meter = mg/m / (mg/L)
  const litersStockPerLinearMeter = mgPerLinearMeter / stockMgPerL;

  // FUZE cost per meter
  const fuzeCostPerLinearMeter = litersStockPerLinearMeter * effectivePricePerLiter;

  // Adders are entered as cents/m → convert to dollars/m here
  const addersPerLinearMeter = (inputs.adders || [])
    .filter(a => a.enabled)
    .reduce((sum, a) => sum + (Number(a.centsPerMeter) || 0) / 100, 0);

  const totalCostPerLinearMeter = fuzeCostPerLinearMeter + addersPerLinearMeter;

  const lengthMeters = inputs.lengthMeters;
  let totalLitersStock: number | undefined;
  let bottles19L: number | undefined;

  if (typeof lengthMeters === "number" && lengthMeters > 0) {
    totalLitersStock = litersStockPerLinearMeter * lengthMeters;
    bottles19L = Math.ceil(totalLitersStock / 19);
  }

  const totalCostPerLinearYard = totalCostPerLinearMeter * METERS_PER_YARD;
  const fuzeCostPerLinearYard = fuzeCostPerLinearMeter * METERS_PER_YARD;
  const addersPerLinearYard = addersPerLinearMeter * METERS_PER_YARD;

  return {
    widthMeters,
    kgPerLinearMeter,
    mgPerLinearMeter,
    litersStockPerLinearMeter,
    effectivePricePerLiter,
    fuzeCostPerLinearMeter,
    addersPerLinearMeter,
    totalCostPerLinearMeter,
    totalLitersStock,
    bottles19L,
  };
}