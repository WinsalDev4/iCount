import { PlaceholderScreen } from '@/shared/ui/PlaceholderScreen';

/** Provisional: B-3.3 replaces this with the history calendar. */
export default function HistoryRoute() {
  return (
    <PlaceholderScreen
      title="Historial"
      icon="list"
      description="Aquí verás todos tus movimientos en un calendario de intensidad."
      edges={['top', 'left', 'right']}
    />
  );
}
