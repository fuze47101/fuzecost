export type FabricFamily = "synthetics" | "cotton" | "blends";

export type PerfPoint = {
  mgPerKg: number;
  antimicrobial: string;
  washDurability: string;
  notes: string[];
};

const points = [
  1.0, 0.9, 0.8, 0.7,
  0.6, 0.5,
  0.4, 0.3, 0.2,
];

function durabilityFor(mg: number): string {
  if (mg >= 1.0) return "Up to and over 100 washes (when applied to specification)";
  if (mg >= 0.7) return "Approximately 75–100 washes (process dependent)";
  if (mg >= 0.5) return "Up to 50 washes (when applied to specification)";
  return "Reduced durability; validate for program requirements";
}

function antimicrobialFor(mg: number): string {
  if (mg >= 0.5) return "99.99%";
  return "Effective; validation recommended";
}

function notesFor(mg: number, family: FabricFamily): string[] {
  const base = [
    "Confirm application level with ICP-MS validation.",
    "Performance depends on fabric construction, finishing chemistry, and process control.",
  ];

  if (mg >= 1.0) {
    base.unshift(
      "FUZE recommended level for premium performance and maximum durability.",
      "Eligible for FUZE certification, enhanced testing, and coordinated marketing."
    );
  } else if (mg >= 0.5) {
    base.unshift(
      "Cost-optimized level with strong antimicrobial performance.",
      "Recommend tighter process control and QC."
    );
  } else {
    base.unshift(
      "Below standard premium recommendation.",
      "Use where pricing sensitivity is critical and validate outcomes carefully."
    );
  }

  if (family === "cotton") {
    base.push("Cotton often delivers strong outcomes at equivalent application levels.");
  }

  return base;
}

function buildFamily(family: FabricFamily, title: string, subtitle: string) {
  return {
    title,
    subtitle,
    points: points.map((mg) => ({
      mgPerKg: mg,
      antimicrobial: antimicrobialFor(mg),
      washDurability: durabilityFor(mg),
      notes: notesFor(mg, family),
    })),
  };
}

export const perfCharts = {
  synthetics: buildFamily(
    "synthetics",
    "Synthetics",
    "Polyester, nylon, elastane blends, technical constructions"
  ),
  cotton: buildFamily(
    "cotton",
    "Cotton",
    "Cotton and cotton-rich constructions"
  ),
  blends: buildFamily(
    "blends",
    "Blends",
    "Cotton/synthetic blends and mixed-fiber systems"
  ),
};

export function recommendedDose(dose: number) {
  if (!isFinite(dose)) return 1.0;
  return points.reduce((prev, curr) =>
    Math.abs(curr - dose) < Math.abs(prev - dose) ? curr : prev
  );
}
