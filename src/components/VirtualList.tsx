import { useEffect, useRef, useState } from 'preact/hooks';

interface Props<T> {
  items: T[];
  /** Altezza fissa di una riga, gap incluso. */
  rowHeight: number;
  renderRow: (item: T) => preact.JSX.Element;
  /** Righe extra sopra e sotto la finestra visibile. */
  overscan?: number;
}

/**
 * Lista finestrata sullo scroll della pagina.
 *
 * Con 1.324 esercizi montare tutte le righe costa mezzo secondo di blocco sul
 * telefono. Qui si tiene un contenitore alto quanto la lista intera e si
 * montano solo le righe visibili: lo scroll resta quello nativo del browser,
 * che su iPhone è l'unico che si comporta bene (rimbalzo, barra che si
 * nasconde, scroll to top toccando l'orologio).
 */
export function VirtualList<T>({ items, rowHeight, renderRow, overscan = 6 }: Props<T>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 20 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const top = host.getBoundingClientRect().top;
      const first = Math.floor(Math.max(0, -top) / rowHeight);
      const visible = Math.ceil(window.innerHeight / rowHeight);
      setRange({
        start: Math.max(0, first - overscan),
        end: Math.min(items.length, first + visible + overscan),
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [items.length, rowHeight, overscan]);

  const start = Math.min(range.start, Math.max(0, items.length - 1));
  const end = Math.min(range.end, items.length);
  const visible = items.slice(start, end);

  return (
    <div ref={hostRef} style={{ height: `${items.length * rowHeight}px`, position: 'relative' }}>
      <div style={{ position: 'absolute', top: `${start * rowHeight}px`, left: 0, right: 0 }}>
        {visible.map(renderRow)}
      </div>
    </div>
  );
}
