export type DilutionBathInputs = {
  bathVolumeLiters: number;      // total bath volume
  targetMgPerL: number;          // target concentration in bath (ppm ~ mg/L)
  stockMgPerL: number;           // FUZE stock concentration (30 mg/L)
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

export type DilutionDoseInputs = {
  fabricKg: number;
  doseMgPerKg: number;
  stockMgPerL: number;
};

export type DilutionDoseOutputs = {
  totalMgNeeded: number;
  stockLitersNeeded: number;
  bottles19L: number;
};

export function calcDoseToStock(i: DilutionDoseInputs): DilutionDoseOutputs {
  const kg = Math.max(0, Number(i.fabricKg) || 0);
  const dose = Math.max(0, Number(i.doseMgPerKg) || 0);
  const stock = Math.max(0.000001, Number(i.stockMgPerL) || 30);

  const totalMgNeeded = kg * dose;
  const stockLitersNeeded = totalMgNeeded / stock;
  const bottles19L = stockLitersNeeded > 0 ? Math.ceil(stockLitersNeeded / 19) : 0;

  return { totalMgNeeded, stockLitersNeeded, bottles19L };
}
