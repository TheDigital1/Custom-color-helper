import { oklabToHex, type OKLab } from './color/convert';
import { paintInfo, paintKey, type PaintRef } from './data/store';

export interface Favorite {
  id: string;
  name: string;
  hex: string;
  oklab: OKLab;
  /** Set when the favorite is a named paint (see paintKey). */
  paint?: string;
  brandName?: string;
  code?: string;
  lrv?: number | null;
  /** For custom colors: the paint it was tuned from. */
  basedOn?: string;
}

export function favoriteFromPaint(ref: PaintRef): Favorite | null {
  const p = paintInfo(ref);
  if (!p) return null;
  return {
    id: `p:${paintKey(ref)}`,
    name: p.name,
    hex: p.hex,
    oklab: p.oklab,
    paint: paintKey(ref),
    brandName: p.brandName,
    code: p.code,
    lrv: p.lrv,
  };
}

export function favoriteFromColor(lab: OKLab, basedOn: PaintRef | null): Favorite {
  const hex = oklabToHex(lab);
  const base = basedOn ? paintInfo(basedOn) : null;
  return {
    id: `c:${hex}:${Date.now().toString(36)}`,
    name: `Custom ${hex.toUpperCase()}`,
    hex,
    oklab: lab,
    basedOn: base ? `${base.brandName} ${base.name}${base.code ? ' (' + base.code + ')' : ''}` : undefined,
  };
}

/** Add, replacing an existing favorite for the same paint or hex. */
export function addFavorite(list: Favorite[], f: Favorite): Favorite[] {
  const rest = list.filter((x) => x.id !== f.id && !(x.paint === undefined && f.paint === undefined && x.hex === f.hex));
  return [f, ...rest];
}
