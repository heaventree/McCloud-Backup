/**
 * How many backups to keep for a site, scaled to how often it actually backs up. Shared between
 * site-creation (routes.ts, informational/future use) and the retention sweep (scheduler.ts,
 * which is what actually enforces it) - moved here rather than duplicating the tiering in both
 * places, since keeping two copies in sync is exactly the kind of drift that caused this to go
 * stale in the first place (see runRetentionCleanup()'s doc comment in scheduler.ts for the
 * fuller history: a separate `retentionCount` field existed for this same purpose but was never
 * actually persisted anywhere in production - this computes it live from backupFrequency
 * instead, so it can never go stale relative to a site's current schedule).
 */
export function getRetentionCountByFrequency(frequency: string): number {
  switch (frequency) {
    case 'daily':
      return 30; // Keep 30 daily backups (1 month)
    case 'weekly':
      return 12; // Keep 12 weekly backups (3 months)
    case 'monthly':
      return 12; // Keep 12 monthly backups (1 year)
    case 'yearly':
      return 5; // Keep 5 yearly backups
    default:
      return 10; // Default retention (covers ondemand, 30min, hourly, 12hour)
  }
}
