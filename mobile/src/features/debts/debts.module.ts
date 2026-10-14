import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import { InMemoryDebtRepository } from './data/InMemoryDebtRepository';
import type { DebtRepository } from './domain/DebtRepository';
import { ComparePayoffStrategies } from './domain/usecases/ComparePayoffStrategies';
import {
  CreateDebt,
  DeleteDebt,
  GetAmortizationSchedule,
  GetDebt,
  ListDebts,
  UpdateDebt,
} from './domain/usecases/DebtUseCases';
import { SimulateExtraPayment } from './domain/usecases/SimulateExtraPayment';

export interface DebtsModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Feature module: repository → use cases. The simulations (extra payment, avalanche vs snowball)
 * run on the device with @icount/finance whatever the data source is, so they work offline.
 * The `api` source is chosen in the 4.9 integration (needs the authenticated client).
 */
export function createDebtsModule(config: DebtsModuleConfig) {
  const repository: DebtRepository =
    config.dataSource === 'memory'
      ? new InMemoryDebtRepository()
      : notImplemented<DebtRepository>(`debts(${config.dataSource}).debtRepository`);

  return {
    debtRepository: repository,
    listDebts: new ListDebts(repository),
    getDebt: new GetDebt(repository),
    getAmortizationSchedule: new GetAmortizationSchedule(repository),
    createDebt: new CreateDebt(repository),
    updateDebt: new UpdateDebt(repository),
    deleteDebt: new DeleteDebt(repository),
    simulateExtraPayment: new SimulateExtraPayment(),
    comparePayoffStrategies: new ComparePayoffStrategies(),
  };
}

export type DebtsModule = ReturnType<typeof createDebtsModule>;
