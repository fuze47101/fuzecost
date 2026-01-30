export type DilutionBathInputs = {
  bathVolumeLiters: number;      // total bath volume
  targetMgPerL: number;          // target concentration in bath (ppm ~ mg/L)
  stockMgPerL: number;           // FUZE F1 stock concentration (30 mg/L)
};

export type DilutionBathOutputs = {
  stockLiters: number;
  waterLiters: number;
  bottles19L: number;
};

export function calcBathDilution(i: DilutionBathInputs): DilutionBathOutputs {
  const bath = Math.max(0, Number(i.bathVolumeLiters) || 0);
  const target = Math.max(0, Number(i.targetMgPerL) || 0);
  const stock = Math.max(0.000001, Number(i.stockMgPerL) || 30);

  // C1*V1 = C2*V2 -> V1 = (C2*V2)/C1
  const stockLiters = (target * bath) / stock;
  const waterLiters = Math.max(0, bath - stockLiters);
  const bottles19L = stockLiters > 0 ? Math.ceil(stockLiters / 19) : 0;

  return { stockLiters, waterLiters, bottles19L };
}

export type DoseToStockInputs = {
  fabricKg: number;
  doseMgPerKg: number;
  stockMgPerL: number;
};

export type DoseToStockOutputs = {
  totalF1MgNeeded: number;
  stockLitersNeeded: number;
  bottles19L: number;
};

export function calcDoseToStock(i: DoseToStockInputs): DoseToStockOutputs {
  const kg = Math.max(0, Number(i.fabricKg) || 0);
  const dose = Math.max(0, Number(i.doseMgPerKg) || 0);
  const stock = Math.max(0.000001, Number(i.stockMgPerL) || 30);

  const totalF1MgNeeded = kg * dose;
  const stockLitersNeeded = totalF1MgNeeded / stock;
  const bottles19L = stockLitersNeeded > 0 ? Math.ceil(stockLitersNeeded / 19) : 0;

  return { totalF1MgNeeded, stockLitersNeeded, bottles19L };
}

export type PickupMode = "dry-to-wet" | "wet-on-wet";

export type PickupToBathTargetInputs = {
  doseMgPerKg: number;       // target add-on (mg/kg fabric)
  mode: PickupMode;

  // Dry-to-wet pickup on dry basis (e.g., 80 means 80%)
  pickupPercent?: number;

  // Wet-on-wet: incremental pickup on dry basis (e.g., 15 means +15%)
  incrementalPickupPercent?: number;
};

export type PickupToBathTargetOutputs = {
  pickupFractionLperKg: number; // approx liters per kg fabric
  requiredMgPerL: number;       // ppm ~ mg/L
  requiredGPerL: number;        // g/L
  note: string;
};

export function calcTargetBathFromPickup(i: PickupToBathTargetInputs): PickupToBathTargetOutputs {
  const dose = Math.max(0, Number(i.doseMgPerKg) || 0);

  let pickupFraction = 0;
  let note = "";

  if (i.mode === "dry-to-wet") {
    const p = Math.max(0, Number(i.pickupPercent) || 0);
    pickupFraction = p / 100;
    note = "Dry-to-wet uses pickup % on dry fabric basis.";
  } else {
    const inc = Math.max(0, Number(i.incrementalPickupPercent) || 0);
    pickupFraction = inc / 100;
    note = "Wet-on-wet uses incremental pickup % on dry fabric basis.";
  }

  const requiredMgPerL = pickupFraction > 0 ? dose / pickupFraction : 0;
  const requiredGPerL = requiredMgPerL / 1000;

  return {
    pickupFractionLperKg: pickupFraction,
    requiredMgPerL,
    requiredGPerL,
    note,
  };
}
