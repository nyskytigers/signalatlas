# Signal Persistence

Signal persistence is deterministic and opt-in. By default, `SIGNAL_PERSISTENCE_ENABLED` is not enabled, so live ingestion continues to write existing `Item` records without writing `Signal` rows.

The current processing order is:

1. normalize the source item into `SignalInput`
2. extract and enrich deterministic entities
3. load bounded duplicate candidates
4. decide create, update, review, or skip
5. persist only create/update decisions

The system temporarily dual-writes existing `Item` records and guarded `Signal` rows for the RSS ingestion path only. Review decisions are not persisted. Dry-run mode can validate decisions without writing.

Before enabling live Signal persistence:

1. Apply and verify the `Signal` migration in an approved database environment.
2. Run tests.
3. Run one dry-run ingestion.
4. Inspect create/update/review decisions.
5. Enable `SIGNAL_PERSISTENCE_ENABLED=true`.
6. Run the selected RSS ingestion path.
7. Verify Signal counts and duplicates.

Do not migrate remote Neon automatically, use `prisma db push` on production, or reset any database.
