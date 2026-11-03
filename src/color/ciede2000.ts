/**
 * CIEDE2000 color difference (Sharma, Wu & Dalal 2005), kL = kC = kH = 1.
 *
 * Takes plain numbers so the match search can call it in a tight loop over packed
 * Float32Arrays without allocating. Verified against the Sharma test pairs and culori.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const POW25_7 = 25 ** 7;

export function ciede2000(L1: number, a1: number, b1: number, L2: number, a2: number, b2: number): number {
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = a1p === 0 && b1 === 0 ? 0 : Math.atan2(b1, a1p) * DEG;
  if (h1p < 0) h1p += 360;
  let h2p = a2p === 0 && b2 === 0 ? 0 : Math.atan2(b2, a2p) * DEG;
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  const CpProd = C1p * C2p;
  if (CpProd !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(CpProd) * Math.sin((dhp / 2) * RAD);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp = h1p + h2p;
  if (CpProd !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp /= 2;
    else if (h1p + h2p < 360) hbarp = (hbarp + 360) / 2;
    else hbarp = (hbarp - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * RAD) +
    0.24 * Math.cos(2 * hbarp * RAD) +
    0.32 * Math.cos((3 * hbarp + 6) * RAD) -
    0.2 * Math.cos((4 * hbarp - 63) * RAD);

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + POW25_7));
  const Lm50 = (Lbarp - 50) ** 2;
  const Sl = 1 + (0.015 * Lm50) / Math.sqrt(20 + Lm50);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * RAD) * Rc;

  const tL = dLp / Sl;
  const tC = dCp / Sc;
  const tH = dHp / Sh;
  return Math.sqrt(tL * tL + tC * tC + tH * tH + Rt * tC * tH);
}

export type MatchLabel = 'indistinguishable' | 'very close' | 'subtle' | 'noticeable' | 'different';

/** Plain-English label for a CIEDE2000 value. */
export function deltaELabel(de: number): MatchLabel {
  if (de < 1) return 'indistinguishable';
  if (de < 2) return 'very close';
  if (de < 3.5) return 'subtle';
  if (de <= 5) return 'noticeable';
  return 'different';
}
