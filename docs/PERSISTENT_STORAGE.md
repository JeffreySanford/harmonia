**Persistent Storage Design**

- **Scope:**: Describe the UI → API → Library (inflight) data flow, persistent storage collections, DTO enforcement, and Mongoose schema guidance for the `harmonia` project.
- **Goal:**: Provide a strongly-typed, maintainable data model that avoids a single collection anti-pattern and enables clear ORM interactions and indexes for production workloads.

**Overview:**
- **UI → API → Library Flow:**: The UI sends typed DTOs to the API. The API validates DTOs, transforms them to domain models, persists to Mongo via Mongoose (or TypeORM/MikroORM if preferred), and enqueues background jobs for heavy tasks (model downloads, inference, conversion). The Library layer (inflight) consumes artifacts from mounted storage and writes job results back to Mongo and object storage.

**Requirements:**
- **Strong typing:**: Use TypeScript DTOs with `class-validator` + `class-transformer`, or `zod` schema validation on the API boundary.
- **Schema enforcement:**: Use Mongoose schemas with TypeScript bindings (Typegoose or manual `interface` + `Schema`) to enforce DB invariants.
- **Separation of concerns:**: Avoid putting all documents into one collection. Use one collection per aggregate root / entity type.
- **Auditability & provenance:**: Track `created_by`, `created_at`, `modified_by`, `modified_at`, and `source` metadata on relevant collections.

**Recommended Collections (high-level):**
- **users**: Authentication and account metadata (authentication stored in separate Auth system if possible).
- **projects**: Logical grouping for models, datasets, runs, collaborators, and permissions.
- **model_artifacts**: One doc per model snapshot (path, version, checksums, license metadata, source_url, size, tags).
- **datasets**: Dataset manifests and provenance records.
- **licenses**: Snapshot of license text files and parsed license metadata (spdx, commercial_use boolean, notes).
- **checksums**: Records of computed checksums per artifact and audit history (useful for re-verification).
- **inventory_versions**: Manifest versions referencing sets of `model_artifacts` and `datasets` (immutable once published).
- **jobs**: Background jobs (download, validate, inference) with status, worker assignment, logs, and timestamps.
- **events**: Immutable audit/event log used for replays, notifications, and observability.
- **attachments**: Pointer documents for large files stored in object storage (S3/GCS) — store `url`, `storage_class`, `size`, `hashes`, and `retention_policy`.

**Design patterns & relationships:**
- **References vs Embedding:**: Use references for large or shared objects (e.g., `model_artifacts` referenced by `inventory_versions`), embed small immutable snapshots where a local copy is critical for read speed.
- **ORM interactions:**: Keep repository/DAO layer thin: one repository per collection exposing typed CRUD and domain queries; enrich with domain services for multi-collection transactions (with Mongo session/transaction where needed).
- **DTO enforcement:**: Validate DTOs at the API boundary and map to domain objects. Persist domain objects via Mongoose models that include runtime validation for defensive checks.

**Indexing & performance:**
- **Common indexes:**: `project_id`, `tags`, `status` (on jobs), `artifact_version`, `created_at` (time-series queries) and compound indexes for common filters.
- **TTL & archival:**: Use TTL indexes for transient logs/events; move cold artifacts to separate collection or external object storage and store pointers.

**Versioning & immutability:**
- **Manifest versions:**: Treat `inventory_versions` as immutable snapshots. Reference artifact documents by `artifact_id` + `version`. Never mutate published manifests; create new versions.

**Security & permissions:**
- **Field-level restrictions:**: Store sensitive tokens only in secrets management (Vault/Secrets Manager). Do not persist HF tokens in DB. Use `created_by` and team-based ACLs for project-level access.

**Operational concerns:**
- **Backups & restore:**: Plan collection-level backup/restore, ensure `model_artifacts` and `attachments` can be rehydrated.
- **Monitoring:**: Capture job durations, failure reasons, and per-worker metrics in `events` or `metrics` collection.

**On-disk vs Object-storage:**
- **Large model files:**: Prefer object storage (S3/GCS) for long-term storage. Keep local copies only for active workers and CI warm caches.

**Files to commit (recommended):**
- `docs/PERSISTENT_STORAGE.md` (this file)
- `docs/MONGO_SCHEMA_GUIDE.md` (detailed schema guide)
- `src/models/*.ts` (TypeScript DTOs + Mongoose/Typegoose models)
- `scripts/migrate_inventory_to_db.py` (migration helper)

If you want, I can now scaffold `src/models` DTOs + Mongoose schemas for the collection list above as a follow-up.
