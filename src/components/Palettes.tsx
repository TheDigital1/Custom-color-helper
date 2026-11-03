import { useState } from 'preact/hooks';
import { paletteCsv, paletteText, type Board } from '../palette';
import type { Favorite } from '../favorites';

interface Props {
  boards: Board[];
  activeId: string | null;
  favorites: Favorite[];
  onBoards(boards: Board[]): void;
  onActive(id: string | null): void;
  onAddCurrent(boardId: string): void;
  notify(msg: string): void;
}

const newId = () => Math.random().toString(36).slice(2, 9);

export function Palettes({ boards, activeId, favorites, onBoards, onActive, onAddCurrent, notify }: Props) {
  const [newName, setNewName] = useState('');
  const active = boards.find((b) => b.id === activeId) ?? boards[0] ?? null;
  const update = (b: Board) => onBoards(boards.map((x) => (x.id === b.id ? b : x)));

  const create = () => {
    const name = newName.trim() || `Palette ${boards.length + 1}`;
    const b: Board = { id: newId(), name, items: [] };
    onBoards([...boards, b]);
    onActive(b.id);
    setNewName('');
  };

  const copy = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(paletteText(active));
      notify('Palette copied to clipboard');
    } catch {
      notify('Could not copy: clipboard not available');
    }
  };

  const download = () => {
    if (!active) return;
    const blob = new Blob([paletteCsv(active)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${active.name.replace(/[^\w-]+/g, '_') || 'palette'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div class="palettes">
      <form
        class="palette-new"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <input
          type="text"
          class="text-input"
          placeholder="New palette, e.g. Living room"
          aria-label="New palette name"
          value={newName}
          onInput={(e) => setNewName((e.currentTarget as HTMLInputElement).value)}
        />
        <button type="submit" class="text-btn">
          + New
        </button>
      </form>

      {active && (
        <>
          <div class="palette-head">
            <select class="board-select" aria-label="Palette" value={active.id} onChange={(e) => onActive((e.currentTarget as HTMLSelectElement).value)}>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.items.length})
                </option>
              ))}
            </select>
            <button
              type="button"
              class="small-btn"
              aria-label={`Delete palette ${active.name}`}
              onClick={() => {
                if (!confirm(`Delete palette "${active.name}"?`)) return;
                const rest = boards.filter((b) => b.id !== active.id);
                onBoards(rest);
                onActive(rest[0]?.id ?? null);
              }}
            >
              Delete
            </button>
          </div>
          <div class="fav-actions">
            <button type="button" class="text-btn" onClick={() => onAddCurrent(active.id)}>
              + Current color
            </button>
            {favorites.length > 0 && (
              <select
                class="board-select"
                aria-label="Add a saved color to this palette"
                value=""
                onChange={(e) => {
                  const f = favorites.find((x) => x.id === (e.currentTarget as HTMLSelectElement).value);
                  if (f && !active.items.some((i) => i.id === f.id)) update({ ...active, items: [...active.items, f] });
                }}
              >
                <option value="">+ Add saved color…</option>
                {favorites.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.brandName ? ` (${f.brandName})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          {active.items.length === 0 ? (
            <p class="muted small">This palette is empty.</p>
          ) : (
            <ul class="palette-strip" aria-label={`${active.name} colors`}>
              {active.items.map((f) => (
                <li key={f.id} class="palette-item">
                  <span class="palette-swatch" style={{ background: f.hex }} />
                  <span class="palette-name">{f.name}</span>
                  <span class="palette-meta">{f.brandName ? `${f.brandName}${f.code ? ' · ' + f.code : ''}` : f.hex.toUpperCase()}</span>
                  <button
                    type="button"
                    class="small-btn"
                    aria-label={`Remove ${f.name} from palette`}
                    onClick={() => update({ ...active, items: active.items.filter((i) => i.id !== f.id) })}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div class="fav-actions">
            <button type="button" class="text-btn" onClick={copy} disabled={!active.items.length}>
              Copy as text
            </button>
            <button type="button" class="text-btn" onClick={download} disabled={!active.items.length}>
              Download CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
}
