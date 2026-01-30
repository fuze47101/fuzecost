export type FabricFamily = "synthetics" | "cotton" | "blends";

export type PerfPoint = {
  mgPerKg: number;              // application level
  antimicrobial: string;        // displayed claim (per your instruction)
  washDurability: string;       // displayed guidance
  notes: string[];
};

export const perfCharts: Record<
  FabricFamily,
  { title: string; subtitle: string; points: PerfPoint[] }
> = {
  synthetics: {
    title: "Synthetics",
    subtitle: "Polyester, nylon, elastane blends, technical performance constructions",
    points: [
      {
        mgPerKg: 1.0,
        antimicrobial: "99.99%",
        washDurability: "Up to and over 100 washes (when applied to specification)",
        notes: [
          "Recommended for premium performance and maximum process tolerance.",
          "Strong margin against finishing chemistry and equipment variability.",
        ],
      },
      {
        mgPerKg: 0.5,
        antimicrobial: "99.99%",
        washDurability: "Up to 50 washes (when applied to specification)",
        notes: [
          "Cost-optimized target level.",
          "Recommend validation with ICP-MS and antimicrobial testing.",
        ],
      },
    ],
  },

  cotton: {
    title: "Cotton",
    subtitle: "Cotton and cotton-rich constructions",
    points: [
      {
        mgPerKg: 1.0,
        antimicrobial: "99.99%",
        washDurability: "Up to and over 100 washes (when applied to specification)",
        notes: [
          "Cotton often delivers strong outcomes at the same application levels due to fiber construction.",
          "Recommended for premium performance and maximum consistency.",
        ],
      },
      {
        mgPerKg: 0.5,
        antimicrobial: "99.99%",
        washDurability: "Up to 50 washes (when applied to specification)",
        notes: [
          "Cost-optimized target level.",
          "Recommend validation with ICP-MS and antimicrobial testing.",
        ],
      },
    ],
  },

  blends: {
    title: "Blends",
    subtitle: "Cotton/synthetic blends and mixed-fiber systems",
    points: [
      {
        mgPerKg: 1.0,
        antimicrobial: "99.99%",
        washDurability: "Up to and over 100 washes (when applied to specification)",
        notes: [
          "Best balance of robustness across mixed fiber behavior.",
          "Recommended for premium performance and maximum consistency.",
        ],
      },
      {
        mgPerKg: 0.5,
        antimicrobial: "99.99%",
        washDurability: "Up to 50 washes (when applied to specification)",
        notes: [
          "Cost-optimized target level.",
          "Recommend validation with ICP-MS and antimicrobial testing.",
        ],
      },
    ],
  },
};

export function clampDoseToSupported(dose: number) {
  // We only display 0.5 and 1.0 points as requested.
  // Clamp so the UI always highlights one of these.
  if (!isFinite(dose)) return 1.0;
  return dose >= 0.75 ? 1.0 : 0.5;
}
