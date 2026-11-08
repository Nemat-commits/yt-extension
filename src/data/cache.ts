import { pruneExpiredData } from './storage';

/** Safe for startup/install hooks; pruning is best-effort and never blocks extension boot. */
export async function pruneExpiredSnapshotsAndProgress(): Promise<void> {
  try {
    await pruneExpiredData();
  } catch {
    // A full or temporarily unavailable storage area should not prevent the extension from starting.
  }
}
