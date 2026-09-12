import { navigate, route, type PageName } from '../router';

/** Icone a tratto, 21px, ereditano currentColor dalla tab attiva. */
const ICONS: Record<string, preact.JSX.Element> = {
  oggi: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M12 3 20 8v8l-8 5-8-5V8z" />
    </svg>
  ),
  piano: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  schede: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M5 4h14v16l-7-4-7 4z" />
    </svg>
  ),
  catalogo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  ),
  progressi: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M4 18V9M10 18V5M16 18v-6M22 18H2" />
    </svg>
  ),
};

const TABS: { page: PageName; label: string }[] = [
  { page: 'oggi', label: 'Oggi' },
  { page: 'piano', label: 'Piano' },
  { page: 'schede', label: 'Schede' },
  { page: 'catalogo', label: 'Catalogo' },
  { page: 'progressi', label: 'Progressi' },
];

export function TabBar() {
  const current = route.value.page;
  return (
    <nav class="tabbar" aria-label="Navigazione principale">
      {TABS.map((t) => (
        <button
          key={t.page}
          class="tab"
          type="button"
          aria-current={current === t.page ? 'page' : undefined}
          onClick={() => navigate(t.page)}
        >
          {ICONS[t.page]}
          {t.label}
        </button>
      ))}
    </nav>
  );
}
