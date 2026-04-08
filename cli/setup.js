/**
 * CLI Command: setup
 *
 * Checks dependencies and environment readiness.
 */

import { banner, info } from './shared.js';

export async function cmdSetup() {
  banner();
  console.log(`${info} Running environment checks...`);
  console.log('');

  // Delegate to setup.js which has all the detection logic
  await import('../setup.js');
}
