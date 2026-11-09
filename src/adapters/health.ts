import type { FeatureHealth } from '@src/data/models';
import { readFeatureHealth, writeFeatureHealth } from '@src/data/storage';

export const ADAPTER_FAILURE_LIMIT = 3;

export async function isFeatureCircuitOpen(featureId: string): Promise<boolean> {
  const health = await readFeatureHealth();
  return health.disabled[featureId] === true;
}

export async function recordFeatureSuccess(featureId: string): Promise<void> {
  const health = await readFeatureHealth();
  const failures = { ...health.failures, [featureId]: 0 };
  const disabled = { ...health.disabled };
  delete disabled[featureId];
  await writeFeatureHealth({ failures, disabled, updatedAt: Date.now() });
}

export async function recordFeatureFailure(featureId: string): Promise<FeatureHealth> {
  const health = await readFeatureHealth();
  const count = (health.failures[featureId] ?? 0) + 1;
  const next: FeatureHealth = {
    failures: { ...health.failures, [featureId]: count },
    disabled: { ...health.disabled, ...(count >= ADAPTER_FAILURE_LIMIT ? { [featureId]: true } : {}) },
    updatedAt: Date.now(),
  };
  await writeFeatureHealth(next);
  return next;
}
