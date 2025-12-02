# DTOs and Example Models

**Purpose:** Show TypeScript DTO patterns, validation, and example Mongoose model wiring for the `harmonia` API.

**API Boundary (DTO) Guidance:**

- **Validation stack:**: Prefer `class-validator` + `class-transformer` or `zod`. Validate at the controller boundary and reject malformed requests early.
- **Mapping:**: Use lightweight mappers to convert validated DTOs into domain objects that the repository layer persists.

**Example DTO (TypeScript with class-validator):**

```ts
// src/dto/CreateModelArtifact.dto.ts
import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class CreateModelArtifactDto {
  @IsString()
  name!: string;

  @IsString()
  version!: string;

  @IsString()
  path!: string;

  @IsNumber()
  size_bytes!: number;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
```

**Example service flow:**

- Controller receives `CreateModelArtifactDto` → validated → `ModelArtifactService.create(dto)` → service maps DTO to Mongoose model and saves → returns `ModelArtifact` document.

**Example Mongoose + DTO wiring:**

```ts
// src/services/modelArtifactService.ts
import { CreateModelArtifactDto } from '../dto/CreateModelArtifact.dto';
import { ModelArtifact } from '../models/modelArtifact';

export async function createArtifact(dto: CreateModelArtifactDto) {
  const doc = new ModelArtifact(dto);
  await doc.save();
  return doc;
}
```

If you'd like, I can scaffold these `src/dto` and `src/models` files and add a small unit test using `mongodb-memory-server` to validate the create flow.
