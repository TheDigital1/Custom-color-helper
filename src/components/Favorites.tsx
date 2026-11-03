import type { Favorite } from '../favorites';

interface Props {
  favorites: Favorite[];
  onSaveCurrent(): void;
  onSaveOriginal(): void;
  onRemove(id: string): void;
  onUse(f: Favorite): void;
}

export function Favorites({ favorites, onSaveCurrent, onSaveOriginal, onRemove, onUse }: Props) {
  return (
    <div class="favorites">
      <div class="fav-actions">
        <button type="button" class="text-btn" onClick={onSaveCurrent}>
          ★ Save current color
        </button>
        <button type="button" class="text-btn" onClick={onSaveOriginal}>
          ★ Save original paint
        </button>
      </div>
      {favorites.length === 0 ? (
        <p class="muted small">Saved colors appear here and can be used in the room mockup and palettes.</p>
      ) : (
        <ul class="match-list fav-list">
          {favorites.map((f) => (
            <li class="match-row" key={f.id} data-fav={f.id}>
              <span class="chip chip-lg" style={{ background: f.hex }} />
              <span class="match-text">
                <span class="hit-name">{f.name}</span>
                <span class="hit-meta">
                  {f.brandName ? `${f.brandName}${f.code ? ' · ' + f.code : ''}` : f.basedOn ? `tuned from ${f.basedOn}` : f.hex.toUpperCase()}
                  {f.lrv != null ? ` · LRV ${f.lrv}` : ''}
                </span>
              </span>
              <span class="match-actions">
                <button type="button" class="small-btn" onClick={() => onUse(f)} aria-label={`Load ${f.name}`}>
                  Load
                </button>
                <button type="button" class="small-btn" onClick={() => onRemove(f.id)} aria-label={`Remove ${f.name}`}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
