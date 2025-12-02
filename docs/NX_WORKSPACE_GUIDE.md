# Nx Workspace Guide

## Overview

Harmonia uses **Nx 22.1.3** as a monorepo orchestration tool with pnpm workspace integration. This guide covers Nx commands, workspace structure, and best practices for Phase 1 development.

## Workspace Structure

```
harmonia/
├── apps/                          # Application projects
│   ├── frontend/                  # Angular 21 application
│   ├── frontend-e2e/              # Playwright E2E tests
│   ├── backend/                   # NestJS 11 API server
│   └── backend-e2e/               # Jest E2E tests
├── docs/                          # Documentation (27 files)
├── scripts/                       # Build/deployment scripts
├── nx.json                        # Nx workspace configuration
├── pnpm-workspace.yaml            # pnpm workspace definition
├── package.json                   # Root dependencies
└── tsconfig.json                  # Base TypeScript config
```

## Core Nx Commands

### Development

```bash
# Serve frontend (Angular dev server on http://localhost:4200)
nx serve frontend

# Serve backend (NestJS on http://localhost:3333)
nx serve backend

# Serve both frontend and backend
nx run-many --target=serve --projects=frontend,backend

# Serve with production build
nx serve frontend --configuration=production
```

### Building

```bash
# Build frontend
nx build frontend

# Build backend
nx build backend

# Build all apps
nx run-many --target=build --all

# Build with production optimizations
nx build frontend --configuration=production

# Build with output path override
nx build frontend --output-path=dist/custom-path
```

### Testing

```bash
# Run frontend unit tests (Jest)
nx test frontend

# Run backend unit tests (Jest)
nx test backend

# Run all unit tests
nx run-many --target=test --all

# Run tests with coverage
nx test frontend --coverage

# Run tests in watch mode
nx test frontend --watch

# Run E2E tests (Playwright for frontend)
nx e2e frontend-e2e

# Run E2E tests (Jest for backend)
nx e2e backend-e2e
```

### Linting & Formatting

```bash
# Lint frontend
nx lint frontend

# Lint backend
nx lint backend

# Lint all projects
nx run-many --target=lint --all

# Auto-fix linting errors
nx lint frontend --fix

# Format code with Prettier
pnpm exec prettier --write "apps/**/*.{ts,html,scss,json}"
```

### Code Generation

```bash
# Generate Angular component (in frontend)
nx generate @nx/angular:component components/my-component --project=frontend

# Generate Angular service
nx generate @nx/angular:service services/my-service --project=frontend

# Generate NestJS module (in backend)
nx generate @nestjs/schematics:module modules/my-module --project=backend

# Generate NestJS controller
nx generate @nestjs/schematics:controller controllers/my-controller --project=backend

# Generate NestJS service
nx generate @nestjs/schematics:service services/my-service --project=backend
```

### Dependency Graph

```bash
# View project dependency graph (opens browser)
nx graph

# Generate static graph (outputs to html)
nx graph --file=graph.html
```

### Nx Cache Management

```bash
# Clear Nx cache
nx reset

# Show cache statistics
nx show cache

# Run command without cache
nx build frontend --skip-nx-cache
```

## Project Configuration

Each project has a `project.json` file defining targets (build, serve, test, lint).

### Frontend (`apps/frontend/project.json`)

```json
{
  "name": "frontend",
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:application",
      "options": {
        "outputPath": "dist/apps/frontend",
        "index": "apps/frontend/src/index.html",
        "browser": "apps/frontend/src/main.ts",
        "tsConfig": "apps/frontend/tsconfig.app.json",
        "styles": [
          "apps/frontend/src/styles.scss",
          "apps/frontend/src/theme.scss"
        ]
      }
    },
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "buildTarget": "frontend:build"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/frontend/jest.config.ts"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

### Backend (`apps/backend/project.json`)

```json
{
  "name": "backend",
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "outputPath": "dist/apps/backend",
        "main": "apps/backend/src/main.ts",
        "tsConfig": "apps/backend/tsconfig.app.json",
        "target": "node",
        "compiler": "tsc"
      }
    },
    "serve": {
      "executor": "@nx/js:node",
      "options": {
        "buildTarget": "backend:build"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/backend/jest.config.ts"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

## Nx Configuration (`nx.json`)

```json
{
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "test": {
      "cache": true
    },
    "lint": {
      "cache": true
    }
  },
  "defaultProject": "frontend"
}
```

## Affected Commands

Nx can run commands only on projects affected by code changes:

```bash
# Build only affected projects
nx affected --target=build

# Test only affected projects
nx affected --target=test

# Lint only affected projects
nx affected --target=lint

# Specify base branch for comparison
nx affected --target=build --base=main --head=HEAD
```

## Parallel Execution

```bash
# Run tests in parallel (default: 3 workers)
nx run-many --target=test --all --parallel=3

# Build all projects in parallel
nx run-many --target=build --all --parallel=5

# Disable parallelization
nx run-many --target=build --all --parallel=1
```

## Environment Variables

### Frontend

Create `apps/frontend/.env` or `apps/frontend/.env.local`:

```env
NX_API_URL=http://localhost:3333
NX_WS_URL=ws://localhost:3333
```

Access in TypeScript:

```typescript
const apiUrl = process.env['NX_API_URL'];
```

### Backend

Create `apps/backend/.env` or `apps/backend/.env.local`:

```env
PORT=3333
MONGODB_URI=mongodb://localhost:27017/harmonia
JWT_SECRET=your-secret-key
```

Access in NestJS:

```typescript
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot()],
})
export class AppModule {}
```

## Workspace Tasks

### Running Multiple Targets

```bash
# Build and test frontend
nx run frontend:build && nx run frontend:test

# Serve frontend and backend simultaneously (use terminal multiplexer)
nx serve frontend & nx serve backend
```

### Watch Mode

```bash
# Watch and rebuild on file changes
nx build frontend --watch

# Watch tests
nx test frontend --watch
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0 # Required for Nx affected commands

      - uses: pnpm/action-setup@v2
        with:
          version: 10.23.0

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: nx affected --target=build --base=origin/master
      - run: nx affected --target=test --base=origin/master
      - run: nx affected --target=lint --base=origin/master
```

## Nx Console (VS Code Extension)

Install **Nx Console** for VS Code:

- Visual project explorer
- GUI for running Nx commands
- Code generation wizards
- Dependency graph visualization

## Troubleshooting

### Clear Cache and Reinstall

```bash
# Clear Nx cache
nx reset

# Remove node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Build Errors

```bash
# Check TypeScript compilation
nx run frontend:build --verbose

# Check for circular dependencies
nx graph --affected
```

### Port Conflicts

```bash
# Serve on custom port
nx serve frontend --port=4300
nx serve backend --port=3400
```

### Memory Issues

```bash
# Increase Node.js memory limit
NODE_OPTIONS=--max-old-space-size=4096 nx build frontend
```

## Best Practices

1. **Use Nx Commands**: Always use `nx` instead of `ng` or `nest` CLI commands
2. **Leverage Caching**: Nx caches build outputs - use `nx reset` sparingly
3. **Run Affected**: Use `nx affected` in CI/CD to speed up pipelines
4. **Project Boundaries**: Keep clear separation between frontend/backend code
5. **Shared Libraries**: Create shared libs for common code (future Phase 2)
6. **Incremental Builds**: Use `--watch` for development, avoid full rebuilds
7. **Parallel Execution**: Use `--parallel` for multi-project commands
8. **Environment Files**: Use `.env.local` for local overrides (gitignored)

## Nx Plugins

### Installed Plugins

- `@nx/angular` - Angular application support
- `@nx/nest` - NestJS application support
- `@nx/jest` - Jest testing integration
- `@nx/eslint` - ESLint linting integration
- `@nx/webpack` - Webpack bundling for backend

### Available Commands

```bash
# List all installed plugins
nx list

# Show plugin capabilities
nx list @nx/angular
```

## Next Steps

- **Phase 1 Development**: Build UI components and API endpoints
- **Shared Libraries**: Create `@harmonia/shared` library for DTOs (Phase 2)
- **Deployment**: Configure production builds with environment-specific configs
- **Monitoring**: Integrate Nx Cloud for distributed caching (optional)

## Resources

- [Nx Documentation](https://nx.dev)
- [Nx Angular Plugin](https://nx.dev/packages/angular)
- [Nx NestJS Plugin](https://nx.dev/packages/nest)
- [Nx Console VS Code Extension](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console)
