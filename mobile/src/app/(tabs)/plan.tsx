import { PlaceholderScreen } from '@/shared/ui/PlaceholderScreen';

/** Provisional: B-4.1 replaces this with the planning hub (budgets, debts, recurring). */
export default function PlanRoute() {
  return (
    <PlaceholderScreen
      title="Planificar"
      icon="target"
      description="Presupuestos, deudas y pagos recurrentes llegarán aquí."
      edges={['top', 'left', 'right']}
    />
  );
}
