import { useEffect } from 'preact/hooks';

interface Props {
  title: string;
  onClose: () => void;
  children: preact.ComponentChildren;
}

/**
 * Pannello che sale dal basso. Su un telefono è il posto giusto per i moduli:
 * arriva vicino al pollice, non fa perdere il contesto di quello che c'è
 * sotto, e si chiude con un gesto o con l'indietro.
 */
export function Sheet({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="sheet-grip" aria-hidden="true" />
        <div class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn" type="button" onClick={onClose} aria-label="Chiudi">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}
