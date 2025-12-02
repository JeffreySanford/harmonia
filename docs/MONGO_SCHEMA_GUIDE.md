**Mongo Schema Guide**

- **Purpose:**: Provide concrete Mongoose schema patterns, recommended collection layout, and examples for `harmonia`.

**Schema Principles:**
- **Aggregate roots:**: Model collections around aggregate roots (e.g., `model_artifacts`, `inventory_versions`, `jobs`) — keep each aggregate's invariants in a single place.
- **Normalized references:**: Use `ObjectId` references for shared resources, avoid duplicating large binary payloads.
- **Small embedded documents:**: Embed small immutable snapshots inside parent documents when it improves read performance and the embedded data is immutable.

**Example Entities & Fields:**

- **model_artifacts**
  - `name`: string
  - `version`: string
  - `path`: string (s3/path or local path)
  - `size_bytes`: number
  - `hashes`: { `sha256`: string }
  - `license_id`: ObjectId -> `licenses`
  - `tags`: [string]
  - `created_at`, `created_by`

- **licenses**
  - `spdx_id`: string
  - `text_path`: string (local path or object storage pointer)
  - `commercial_use`: boolean
  - `notes`: string

- **inventory_versions**
  - `version_tag`: string
  - `artifact_ids`: [ObjectId] -> `model_artifacts`
  - `datasets`: [ObjectId] -> `datasets`
  - `published_by`, `published_at`

- **jobs**
  - `type`: enum (download, validate, inference)
  - `status`: enum (pending, running, success, failed)
  - `worker_id`: string
  - `params`: mixed (stored as JSON)
  - `logs`: reference to `events` or embedded tail log
  - `started_at`, `finished_at`

**Sample Mongoose snippets (TypeScript friendly):**

Use `type` + `interface` to keep TypeScript types in sync with Mongoose schemas.

Example pattern:

```ts
// src/models/modelArtifact.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface IModelArtifact extends Document {
  name: string;
  version: string;
  path: string;
  size_bytes: number;
  hashes: { sha256: string };
  license_id?: Types.ObjectId;
}

const ModelArtifactSchema = new Schema<IModelArtifact>({
  name: { type: String, required: true },
  version: { type: String, required: true },
  path: { type: String, required: true },
  size_bytes: { type: Number, required: true },
  hashes: { sha256: String },
  license_id: { type: Schema.Types.ObjectId, ref: 'License' }
}, { timestamps: true });

export const ModelArtifact = model<IModelArtifact>('ModelArtifact', ModelArtifactSchema);
```

**Transactions & multi-collection updates:**
- Use Mongo sessions for atomic multi-collection updates (e.g., publishing an `inventory_version` and marking artifacts as `published=true`). Wrap business operations in a service layer that starts/commits a session.

**Index examples:**
- `ModelArtifactSchema.index({ name: 1, version: 1 }, { unique: true });`
- `JobsSchema.index({ status: 1, worker_id: 1 });`

**Migration & backward-compatibility:**
- Keep transforms inside migration scripts. Add `schema_version` on collections when introducing breaking changes.

**Testing the schema:**
- Use an in-memory Mongo (e.g., `mongodb-memory-server`) for unit and CI tests to validate schema constraints and business logic.

If you'd like, I can scaffold `src/models/*.ts` files for these entities and a small migration that imports `inventory/combined_inventory.json` into `model_artifacts` and `inventory_versions`.
