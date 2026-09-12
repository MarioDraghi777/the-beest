import { navigate, route } from '../router';
import { countDoneSets, countPlannedSets, formatClock } from '../services/sessionMath';
import { active, now } from '../stores/session';

/**
 * Barra di rientro: se c'è un allenamento aperto e sei finito da un'altra
 * parte (a cercare un esercizio, per dire), questa è la strada per tornarci.
 * Senza, l'allenamento in corso si perde di vista ed è un modo sicuro di far
 * arrabbiare chi ha le mani sul bilanciere.
 */
export function LiveBanner() {
  const session = active.value;
  if (!session || route.value.page === 'allenamento') return null;

  return (
    <button class="live-banner" type="button" onClick={() => navigate('allenamento')}>
      <i class="live-dot" aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span class="live-banner-name">{session.name}</span>
        <span class="sub num">
          {countDoneSets(session)}/{countPlannedSets(session)} serie · {formatClock(now.value - session.startedAt)}
        </span>
      </span>
      <span class="live-banner-cta">Riprendi</span>
    </button>
  );
}
