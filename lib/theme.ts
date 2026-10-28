import type { PaletteId } from "./types";

const L = [0.965, 0.92, 0.85, 0.75, 0.64, 0.54, 0.44, 0.34, 0.25];
const C = [0.3, 0.5, 0.72, 0.9, 1, 1, 0.96, 0.88, 0.76];

interface Palette {
  label: string;
  neutral: [number, number];
  accent: [number, number];
  accent2: [number, number];
  bg: string;
  surface: string;
  text: string;
}

export const PALETTES: Record<PaletteId, Palette> = {
  dusk: {
    label: "Dusk & sky",
    neutral: [275, 0.016], accent: [228, 0.085], accent2: [282, 0.08],
    bg: "oklch(.965 .008 290)", surface: "oklch(.92 .014 290)", text: "oklch(.24 .03 270)",
  },
  emerald: {
    label: "Emerald & gold",
    neutral: [165, 0.016], accent: [160, 0.1], accent2: [85, 0.11],
    bg: "oklch(.97 .01 120)", surface: "oklch(.925 .018 130)", text: "oklch(.24 .03 165)",
  },
  navy: {
    label: "Navy & gold",
    neutral: [255, 0.016], accent: [258, 0.1], accent2: [82, 0.11],
    bg: "oklch(.97 .008 250)", surface: "oklch(.925 .016 250)", text: "oklch(.24 .04 258)",
  },
  burgundy: {
    label: "Burgundy & emerald",
    neutral: [15, 0.014], accent: [12, 0.13], accent2: [160, 0.09],
    bg: "oklch(.968 .008 30)", surface: "oklch(.92 .016 25)", text: "oklch(.24 .035 15)",
  },
  organic: {
    label: "Organic",
    neutral: [65, 0.025], accent: [50, 0.13], accent2: [125, 0.065],
    bg: "#f5ead8", surface: "oklch(.9 .03 75)", text: "oklch(.28 .035 50)",
  },
};

const ramp = (name: string, [h, c]: [number, number]) =>
  L.map((l, i) => `--${name}-${(i + 1) * 100}: oklch(${l} ${+(c * C[i]).toFixed(4)} ${h});`).join("");

/** Background, accent-500 and accent-2-500 of a palette, for small previews. */
export function swatchColors(id: PaletteId) {
  const p = PALETTES[id];
  return [p.bg, `oklch(.64 ${p.accent[1]} ${p.accent[0]})`, `oklch(.64 ${p.accent2[1]} ${p.accent2[0]})`];
}

/** CSS variable declarations for a palette; `dark` produces the dusky TV ground. */
export function themeCss(id: PaletteId, dark: boolean) {
  const p = PALETTES[id] ?? PALETTES.dusk;
  const H = p.neutral[0];
  const base = ramp("neutral", p.neutral) + ramp("accent", p.accent) + ramp("accent-2", p.accent2);
  const surfaces = dark
    ? `--bg: oklch(.25 .03 ${H}); --surface: oklch(.31 .034 ${H}); --text: oklch(.93 .012 290); --muted: oklch(.76 .02 290);
       --num: var(--accent-400); --ring: var(--accent-400); --ok: var(--accent-2-400); --line: oklch(.4 .03 ${H});
       --shadow: 0 10px 30px oklch(.12 .03 ${H} / .45);`
    : `--bg: ${p.bg}; --surface: ${p.surface}; --text: ${p.text}; --muted: var(--neutral-700);
       --num: var(--accent-600); --ring: var(--accent-500); --ok: var(--accent-2-600); --line: var(--neutral-300);
       --shadow: 0 10px 30px oklch(.3 .04 ${H} / .14);`;
  return base + surfaces;
}
