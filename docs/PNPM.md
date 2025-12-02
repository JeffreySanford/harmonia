# PNPM: Modern, Secure, and Efficient Package Management

This project uses `pnpm` as the exclusive package manager. `pnpm` provides significant advantages over `npm` and `yarn` in performance, security, and disk efficiency.

## Why PNPM?

### 1. Security Benefits

#### Strict Dependency Isolation

- Unlike `npm`, pnpm uses a content-addressable store and symlinks, preventing phantom dependencies
- Packages can only access dependencies explicitly declared in `package.json` — no implicit access to hoisted modules
- Eliminates an entire class of supply chain attacks where malicious packages access undeclared dependencies
- Prevents "works on my machine" bugs caused by accidentally using hoisted dependencies

#### Lockfile Integrity

- `pnpm-lock.yaml` includes checksums for all packages
- Reproducible builds across all environments (dev, CI, production)
- Detects tampering or registry corruption immediately
- Git-friendly lockfile format (minimal diffs, easy to review)

#### No Privilege Escalation

- Installation scripts run in isolated contexts
- Reduced risk from compromised packages during `postinstall` hooks

### 2. Performance Advantages

#### Disk Space Efficiency

- Global content-addressable store: one copy of each package version system-wide
- Typical projects save 50-75% disk space compared to `npm`
- Perfect for monorepos and multiple projects on one machine
- Your i9 can host dozens of projects without duplicate `node_modules` bloat

#### Installation Speed

- 2-3x faster than `npm install` on cache hits
- Parallel installation with intelligent dependency resolution
- Cached packages are instantly available (no network hit)
- CI builds complete faster (critical for large monorepos)

**Benchmarks (typical React project):**

```plaintext
npm install:    45-60 seconds (cold), 25-35 seconds (warm)
pnpm install:   15-20 seconds (cold), 3-5 seconds (warm)
```

### 3. Correctness & Reliability

#### Non-Flat node_modules

- Pnpm's structure mirrors actual dependency graph
- No hidden hoisting surprises
- Enforces proper peer dependency declarations
- Catches bugs npm would silently ignore

#### Reproducible Everywhere

- Identical `node_modules` structure on all platforms (Windows, Linux, macOS)
- No platform-specific quirks or symlink issues
- CI matches local dev exactly

### 4. Developer Experience

#### Monorepo Support

- First-class workspace support with `pnpm-workspace.yaml`
- Efficient linking between workspace packages
- Shared dependency deduplication across all packages
- Built-in filtering (`pnpm --filter <pkg>`)

#### Drop-in Replacement

- Reads existing `package.json` (no migration needed)
- Commands mirror npm: `pnpm add`, `pnpm test`, `pnpm run`
- Easy adoption for existing projects

## Security Deep Dive

### Phantom Dependency Prevention

**Problem with npm:**

```plaintext
your-app/
├── package.json (depends on: express)
└── node_modules/
    ├── express/
    └── body-parser/  ← Hoisted by npm, accessible even though not declared!
```

Your code can `require('body-parser')` even though it's not in `package.json`. If `express` drops `body-parser`, your app breaks.

**With pnpm:**

```plaintext
your-app/
├── package.json (depends on: express)
└── node_modules/
    ├── express -> .pnpm/express@4.18.0/node_modules/express
    └── .pnpm/
        ├── express@4.18.0/
        │   └── node_modules/
        │       ├── express/
        │       └── body-parser/  ← Only express can access this
```

`require('body-parser')` fails immediately — forces explicit dependency declaration.

### Supply Chain Attack Mitigation

**Attack vector npm allows:**

1. Malicious package `evil-pkg` gets published
2. Popular package `good-pkg` depends on `evil-pkg`
3. `npm install good-pkg` hoists `evil-pkg` to top-level
4. ANY package in your tree can now `require('evil-pkg')` and execute its code

**With pnpm:**

- `evil-pkg` is isolated to `good-pkg`'s dependency subtree
- Other packages cannot access it
- Attack surface reduced to only `good-pkg` (which you can audit)

## Quick Steps to Get Started Locally

1. Install `pnpm` (if you don't already have it):

```bash
npm install -g pnpm
# or using corepack (recommended on modern Node versions)
corepack enable
corepack prepare pnpm@8 --activate
```

1. Install dependencies with `pnpm` from repo root:

```bash
pnpm install
```

1. Run the memory-server test we added:

```bash
pnpm test:mongo
```

## Migration Tips for Existing Projects

**First-time setup:**

```bash
# Remove old npm artifacts
rm -rf node_modules package-lock.json

# Install with pnpm
pnpm install

# Commit new lockfile
git add pnpm-lock.yaml
git commit -m "chore: migrate to pnpm"
```

**For CI/CD (GitHub Actions example):**

```yaml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: '18'

- name: Enable corepack
  run: corepack enable

- name: Install pnpm
  run: corepack prepare pnpm@8 --activate

- name: Install dependencies
  run: pnpm install --frozen-lockfile  # Use lockfile only, fail if mismatch
```

## Common Commands

```bash
# Install dependencies
pnpm install                    # Install all deps
pnpm install --frozen-lockfile  # CI mode (strict lockfile)
pnpm install --prefer-offline   # Use cache when possible

# Add/remove packages
pnpm add <pkg>                  # Add to dependencies
pnpm add -D <pkg>               # Add to devDependencies
pnpm add -g <pkg>               # Add globally
pnpm remove <pkg>               # Remove package

# Workspace commands
pnpm -w add <pkg>               # Add to workspace root
pnpm --filter <pkg> install     # Install for specific workspace package
pnpm --filter <pkg> test        # Run tests for specific package

# Run scripts
pnpm test                       # Run test script
pnpm test:mongo                 # Run specific script
pnpm dlx <tool>                 # Run temporary binaries (like npx)

# Maintenance
pnpm store status               # Check global store status
pnpm store prune                # Remove unreferenced packages from store
pnpm outdated                   # Check for outdated packages
pnpm update                     # Update packages
```

## Workspace Configuration

The repository includes `pnpm-workspace.yaml`:

```yaml
packages:
  - '.'
  - 'packages/*'
```

This allows future expansion into a monorepo structure where:

- Root contains shared configs and scripts
- `packages/*` can contain frontend, backend, shared libs, etc.

**Example future structure:**

```plaintext
harmonia/
├── package.json (workspace root)
├── pnpm-workspace.yaml
├── packages/
│   ├── frontend/ (Angular app)
│   ├── backend/ (NestJS API)
│   └── shared/ (TypeScript DTOs, types)
└── pnpm-lock.yaml (single lockfile for entire monorepo)
```

## Troubleshooting

**"Cannot find module" errors after migration:**

- Your code likely used phantom dependencies
- Add missing packages explicitly: `pnpm add <missing-pkg>`
- This is a FEATURE — exposes hidden dependencies

**Symlink issues on Windows:**

- Run terminal as Administrator (first install only)
- Or enable Developer Mode in Windows Settings
- Pnpm will fall back to junctions if symlinks unavailable

**CI failing with lockfile mismatch:**

- Run `pnpm install` locally and commit updated `pnpm-lock.yaml`
- Never manually edit lockfile

**Disk space concerns:**

- Check store: `pnpm store status`
- Prune unused: `pnpm store prune`
- Global store typically uses ~2-3GB for dozens of projects

## Performance Tuning

**Parallel installations (faster on multi-core machines like your i9):**

Add to `.npmrc`:

```plaintext
network-concurrency=16
child-concurrency=8
```

**Use local cache mirror (optional for air-gapped environments):**

```plaintext
store-dir=/path/to/custom/store
```

## Security Best Practices

1. **Always commit `pnpm-lock.yaml`**
   - Ensures reproducible builds
   - Locks package checksums
   - Required for security audits

2. **Run audits regularly**

   ```bash
   pnpm audit
   pnpm audit --fix  # Auto-fix vulnerabilities
   ```

3. **Verify lockfile integrity**

   ```bash
   pnpm install --frozen-lockfile  # In CI
   ```

4. **Review dependency changes in PRs**
   - `pnpm-lock.yaml` diffs show exactly what changed
   - Easy to spot unexpected additions

5. **Use `.npmrc` for registry config**

   ```plaintext
   registry=https://registry.npmjs.org/
   # Optional: use private registry for enterprise
   # @mycompany:registry=https://npm.mycompany.com/
   ```

## Comparison Matrix

| Feature | npm | yarn | pnpm |
|---------|-----|------|------|
| Disk efficiency | ❌ Duplicates everything | ⚠️ Better than npm | ✅ Content-addressable store |
| Install speed (cold) | ❌ Slow | ⚠️ Moderate | ✅ Fast |
| Install speed (warm) | ❌ Slow | ✅ Fast | ✅ Fastest |
| Phantom deps prevention | ❌ No | ❌ No | ✅ Yes |
| Lockfile quality | ⚠️ Verbose, merge conflicts | ✅ Good | ✅ Excellent |
| Monorepo support | ⚠️ Basic (workspaces) | ✅ Good | ✅ Excellent |
| Security isolation | ❌ Weak | ❌ Weak | ✅ Strong |
| Windows support | ✅ Native | ✅ Native | ✅ Native |

## Recommended Workflow for Harmonia

1. **Initial setup (already done):**
   - `.npmrc` declares pnpm as manager
   - `pnpm-workspace.yaml` configured
   - `package.json` has scripts

2. **Daily development:**

   ```bash
   pnpm install              # After pulling changes
   pnpm test:mongo           # Run tests
   pnpm add <new-package>    # Add dependencies
   git add pnpm-lock.yaml    # Commit lockfile changes
   ```

3. **CI/CD:**
   - Workflows use `corepack enable` + `pnpm install --frozen-lockfile`
   - Faster builds, lower runner costs

4. **Monorepo expansion (future):**
   - Add packages under `packages/*`
   - Use `pnpm --filter` for selective operations
   - Share dependencies across packages efficiently

## References

- [PNPM Official Docs](https://pnpm.io/)
- [Security Features](https://pnpm.io/feature-comparison)
- [Benchmarks](https://pnpm.io/benchmarks)
- [Workspace Guide](https://pnpm.io/workspaces)

---

**Bottom line for Harmonia:**  
Pnpm provides enterprise-grade security, dramatically faster installations, and efficient disk usage — critical for a project managing large ML models and potentially expanding to a monorepo. The phantom dependency prevention alone justifies migration, as it prevents an entire class of hard-to-debug production failures.
