import { useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

/**
 * Riga che si trascina verso sinistra per scoprire un'azione distruttiva.
 *
 * Il gesto deve convivere con lo scroll della pagina: finché non è chiaro se
 * il dito sta andando in orizzontale o in verticale non si muove niente, e la
 * prima direzione decisa vince fino a quando il dito non si alza. Senza
 * questo, ogni scroll un po' storto aprirebbe una riga.
 *
 * L'azione resta un <button> vero anche da chiusa: chi naviga da tastiera o
 * con lo screen reader non ha un gesto da fare, e deve poterci arrivare.
 */

/** Quanto si scopre l'azione, in pixel. */
const LARGHEZZA = 104;
/** Spostamento oltre il quale si decide la direzione del gesto. */
const SOGLIA_DIREZIONE = 8;

interface Props {
  children: ComponentChildren;
  /** Testo del pulsante scoperto dal gesto. */
  actionLabel: string;
  onAction: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SwipeRow({ children, actionLabel, onAction, open, onOpenChange }: Props) {
  const content = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const asse = useRef<'?' | 'h' | 'v'>('?');
  /** Vero se il dito ha trascinato: serve a non far passare il click sotto. */
  const trascinato = useRef(false);

  const sposta = (px: number | null) => {
    const el = content.current;
    if (!el) return;
    el.style.transition = px === null ? '' : 'none';
    el.style.transform = px === null ? '' : `translateX(${px}px)`;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    asse.current = '?';
    trascinato.current = false;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (asse.current === '?') {
      if (Math.abs(dx) < SOGLIA_DIREZIONE && Math.abs(dy) < SOGLIA_DIREZIONE) return;
      asse.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (asse.current === 'h') content.current?.setPointerCapture(e.pointerId);
    }
    if (asse.current !== 'h') return;

    trascinato.current = true;
    const base = open ? -LARGHEZZA : 0;
    sposta(Math.max(-LARGHEZZA, Math.min(0, base + dx)));
  };

  const onPointerUp = (e: PointerEvent) => {
    if (asse.current === 'h' && start.current) {
      const dx = e.clientX - start.current.x;
      const finale = Math.max(-LARGHEZZA, Math.min(0, (open ? -LARGHEZZA : 0) + dx));
      onOpenChange(finale < -LARGHEZZA / 2);
    }
    start.current = null;
    asse.current = '?';
    sposta(null); // da qui in poi comanda la classe, con la sua transizione
  };

  // Un trascinamento non deve anche aprire la scheda sotto il dito; e con la
  // riga aperta il primo tap serve a richiuderla, non a navigare.
  const onClickCapture = (e: MouseEvent) => {
    if (!trascinato.current && !open) return;
    e.preventDefault();
    e.stopPropagation();
    if (open && !trascinato.current) onOpenChange(false);
    trascinato.current = false;
  };

  return (
    <div class={`swipe-row${open ? ' is-open' : ''}`}>
      <button
        class="swipe-action"
        type="button"
        onClick={() => {
          onOpenChange(false);
          onAction();
        }}
      >
        {actionLabel}
      </button>
      <div
        ref={content}
        class="swipe-content"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
