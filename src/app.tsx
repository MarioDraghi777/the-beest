import { useEffect } from 'preact/hooks';
import { LiveBanner } from './components/LiveBanner';
import { TabBar } from './components/TabBar';
import { CatalogPage } from './pages/CatalogPage';
import { ExercisePage } from './pages/ExercisePage';
import { LivePage } from './pages/LivePage';
import { PlanPage } from './pages/PlanPage';
import { ProgressPage } from './pages/ProgressPage';
import { SharedPage } from './pages/SharedPage';
import { TodayPage } from './pages/TodayPage';
import { WorkoutEditPage } from './pages/WorkoutEditPage';
import { WorkoutsPage } from './pages/WorkoutsPage';
import { route } from './router';
import { loadCatalog } from './services/catalog';
import { loadFavorites } from './stores/favorites';
import { loadPlans } from './stores/plan';
import { loadSessions } from './stores/session';
import { loadWorkouts } from './stores/workouts';

export function App() {
  useEffect(() => {
    void loadCatalog();
    void loadFavorites();
    // Le sessioni servono anche per precompilare i carichi dell'ultima volta,
    // quindi si caricano dopo le schede ma sempre all'avvio.
    void loadWorkouts().then(() => Promise.all([loadSessions(), loadPlans()]));
  }, []);

  const { page, param } = route.value;

  // Schermate piene, senza tab bar: si esce con la freccia o con l'indietro.
  if (page === 'esercizio' && param) return <ExercisePage id={param} />;
  if (page === 'scheda' && param) return <WorkoutEditPage id={param} />;
  if (page === 'allenamento') return <LivePage />;
  if (page === 'condiviso' && param) return <SharedPage code={param} />;

  return (
    <>
      {page === 'catalogo' && <CatalogPage />}
      {page === 'schede' && <WorkoutsPage />}
      {page === 'progressi' && <ProgressPage />}
      {page === 'oggi' && <TodayPage />}
      {page === 'piano' && <PlanPage />}
      <LiveBanner />
      <TabBar />
    </>
  );
}
