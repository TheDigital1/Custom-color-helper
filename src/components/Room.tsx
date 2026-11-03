import { contrastRatio, hexToOklab, type OKLab } from '../color/convert';
import type { Favorite } from '../favorites';

export type Surface = 'wall' | 'trim' | 'ceiling' | 'door';
export const SURFACES: { id: Surface; label: string }[] = [
  { id: 'wall', label: 'Walls' },
  { id: 'trim', label: 'Trim' },
  { id: 'ceiling', label: 'Ceiling' },
  { id: 'door', label: 'Door / accent' },
];

/** Where a surface's color comes from. */
export type ColorChoice = { kind: 'current' } | { kind: 'original' } | { kind: 'fav'; id: string } | { kind: 'hex'; hex: string; name: string };

export type RoomAssignments = Record<Surface, ColorChoice>;

export const DEFAULT_ROOM: RoomAssignments = {
  wall: { kind: 'current' },
  trim: { kind: 'hex', hex: '#f4f2ec', name: 'Default trim (off-white)' },
  ceiling: { kind: 'hex', hex: '#f7f7f5', name: 'Default ceiling (white)' },
  door: { kind: 'original' },
};

interface Props {
  assignments: RoomAssignments;
  favorites: Favorite[];
  current: OKLab;
  original: OKLab;
  originalName: string;
  render(lab: OKLab): string;
  onAssign(surface: Surface, choice: ColorChoice): void;
}

const choiceKey = (c: ColorChoice) => (c.kind === 'fav' ? `fav:${c.id}` : c.kind === 'hex' ? `hex:${c.hex}` : c.kind);

export function resolveChoice(c: ColorChoice, p: { current: OKLab; original: OKLab; originalName: string; favorites: Favorite[] }): { lab: OKLab; name: string } {
  switch (c.kind) {
    case 'current':
      return { lab: p.current, name: 'Current (modified) color' };
    case 'original':
      return { lab: p.original, name: p.originalName };
    case 'fav': {
      const f = p.favorites.find((x) => x.id === c.id);
      return f ? { lab: f.oklab, name: f.name } : { lab: p.current, name: 'Current (modified) color' };
    }
    case 'hex':
      return { lab: hexToOklab(c.hex)!, name: c.name };
  }
}

function ratingFor(r: number) {
  if (r >= 4.5) return 'strong';
  if (r >= 3) return 'clear';
  if (r >= 1.5) return 'soft';
  return 'very subtle';
}

export function Room(props: Props) {
  const { assignments, favorites } = props;
  const resolved = Object.fromEntries(SURFACES.map((s) => [s.id, resolveChoice(assignments[s.id], props)])) as Record<Surface, { lab: OKLab; name: string }>;
  const fill = (s: Surface) => props.render(resolved[s].lab);
  const options: { key: string; label: string; choice: ColorChoice }[] = [
    { key: 'current', label: 'Current (modified) color', choice: { kind: 'current' } },
    { key: 'original', label: `Original: ${props.originalName}`, choice: { kind: 'original' } },
    ...favorites.map((f) => ({ key: `fav:${f.id}`, label: `★ ${f.name}${f.brandName ? ' (' + f.brandName + ')' : ''}`, choice: { kind: 'fav', id: f.id } as ColorChoice })),
    ...SURFACES.map((s) => DEFAULT_ROOM[s.id]).filter((c): c is Extract<ColorChoice, { kind: 'hex' }> => c.kind === 'hex').map((c) => ({ key: choiceKey(c), label: c.name, choice: c as ColorChoice })),
  ];
  const pairs: [Surface, Surface][] = [
    ['wall', 'trim'],
    ['wall', 'door'],
    ['trim', 'door'],
    ['wall', 'ceiling'],
  ];
  const label = (s: Surface) => SURFACES.find((x) => x.id === s)!.label;

  return (
    <div class="room">
      <svg class="room-svg" viewBox="0 0 400 260" role="img" aria-label="Room mockup showing walls, trim, ceiling and door colors">
        {/* Ceiling */}
        <polygon points="0,0 400,0 330,50 70,50" fill={fill('ceiling')} data-surface="ceiling" />
        {/* Side walls (slightly shaded to read as 3D) */}
        <polygon points="0,0 70,50 70,215 0,260" fill={fill('wall')} />
        <polygon points="0,0 70,50 70,215 0,260" fill="#000" opacity="0.08" />
        <polygon points="400,0 330,50 330,215 400,260" fill={fill('wall')} />
        <polygon points="400,0 330,50 330,215 400,260" fill="#000" opacity="0.14" />
        {/* Back wall */}
        <rect x="70" y="50" width="260" height="165" fill={fill('wall')} data-surface="wall" />
        {/* Crown and baseboard trim */}
        <rect x="70" y="50" width="260" height="6" fill={fill('trim')} data-surface="trim" />
        <rect x="70" y="203" width="260" height="12" fill={fill('trim')} />
        <polygon points="0,248 70,206 70,215 0,260" fill={fill('trim')} />
        <polygon points="400,248 330,206 330,215 400,260" fill={fill('trim')} />
        {/* Window with casing */}
        <rect x="96" y="82" width="86" height="80" fill={fill('trim')} />
        <rect x="104" y="90" width="70" height="64" fill="#cfe3f2" />
        <line x1="139" y1="90" x2="139" y2="154" stroke={fill('trim')} stroke-width="4" />
        <line x1="104" y1="122" x2="174" y2="122" stroke={fill('trim')} stroke-width="4" />
        {/* Door with casing */}
        <rect x="228" y="88" width="72" height="127" fill={fill('trim')} />
        <rect x="236" y="96" width="56" height="119" fill={fill('door')} data-surface="door" />
        <rect x="242" y="104" width="44" height="40" fill="none" stroke="#000" stroke-opacity="0.12" />
        <rect x="242" y="152" width="44" height="54" fill="none" stroke="#000" stroke-opacity="0.12" />
        <circle cx="284" cy="160" r="3" fill="#b8a370" />
        {/* Floor (fixed neutral wood tone, not part of the palette) */}
        <polygon points="0,260 70,215 330,215 400,260" fill="#9a7b5b" />
      </svg>

      <div class="room-assign">
        {SURFACES.map((s) => (
          <label class="room-row" key={s.id}>
            <span class="chip" style={{ background: fill(s.id) }} />
            <span class="room-row-label">{s.label}</span>
            <select
              aria-label={`${s.label} color`}
              value={choiceKey(assignments[s.id])}
              onChange={(e) => {
                const o = options.find((x) => x.key === (e.currentTarget as HTMLSelectElement).value);
                if (o) props.onAssign(s.id, o.choice);
              }}
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <table class="contrast-table">
        <caption>Contrast ratio (WCAG, daylight)</caption>
        <tbody>
          {pairs.map(([a, b]) => {
            const r = contrastRatio(resolved[a].lab, resolved[b].lab);
            return (
              <tr key={`${a}-${b}`} data-pair={`${a}-${b}`}>
                <th scope="row">
                  {label(a)} vs. {label(b).toLowerCase()}
                </th>
                <td class="num">{r.toFixed(2)}:1</td>
                <td class="muted">{ratingFor(r)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
