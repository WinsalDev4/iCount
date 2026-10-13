import { prepareTestDatabase } from './test-database.js';

/** Runs once before every e2e file (Vitest globalSetup). */
export default async function setup(): Promise<void> {
  await prepareTestDatabase();
}
