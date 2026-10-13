import { PlaceholderScreen } from '@/shared/ui/PlaceholderScreen';

/** Provisional: B-5.1 replaces this with the shared household (balance and activity). */
export default function HouseholdRoute() {
  return (
    <PlaceholderScreen
      title="Hogar"
      icon="users"
      description="Balance entre miembros y actividad compartida."
      edges={['top', 'left', 'right']}
    />
  );
}
