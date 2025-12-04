# Song Generation E2E Tests

This directory contains end-to-end tests for the song generation feature in Harmonia.

## Test Scenarios

### Scenario 1: Complete Song Generation Flow

Tests the full song generation workflow from narrative input through all musical properties to final generation.

**What it tests:**

- Navigation to song generation page
- Form validation and required fields
- Lyrics analysis selector functionality
- All song property inputs (melody, tempo, key, instrumentation, intro/outro)
- API call to `/api/songs/generate-song`
- Result display with all song properties

### Scenario 2: Song Generation with Minimal Properties

Tests song generation using only the minimum required fields.

**What it tests:**

- Basic form submission with minimal data
- Default value handling
- Successful API response and result display

### Scenario 3: Song Generation Form Validation

Tests form validation and error handling.

**What it tests:**

- Button disabled state when required fields are missing
- Tempo field validation (numeric input)
- Form state management

### Scenario 4: Lyrics Analysis Selector Integration

Tests the lyrics analysis selector functionality specifically.

**What it tests:**

- Analysis options availability
- Selection persistence
- Analysis data inclusion in API request

### Scenario 5: Song Generation Error Handling

Tests error scenarios and user feedback.

**What it tests:**

- Backend error response handling
- Error message display to user
- Graceful failure recovery

## Test Data

The tests use predefined test data from `helpers.ts`:

- **simple**: Basic song with minimal properties
- **complex**: Full-featured song with all properties including intro/outro
- **minimal**: Only required fields for basic functionality testing

## Running the Tests

### Prerequisites

1. **Environment Setup**: Run the E2E test setup script:

   ```bash
   pnpm run test:e2e:setup
   ```

2. **Services Running**: Ensure both frontend and backend services are running:

   ```bash
   pnpm run dev  # Runs both frontend (port 4200) and backend (port 3000)
   ```

3. **Test Users**: Ensure test user credentials are set in environment variables:
   - `E2E_TEST_USER_EMAIL`
   - `E2E_TEST_USER_PASSWORD`
   - `E2E_TEST_USER_USERNAME`

### Execution

Run all song generation E2E tests:

```bash
pnpm run test:e2e tests/e2e/song-generation/
```

Run specific test file:

```bash
npx playwright test tests/e2e/song-generation/song-generation.spec.ts
```

Run with headed browser (visible):

```bash
npx playwright test tests/e2e/song-generation/ --headed
```

Run in debug mode:

```bash
npx playwright test tests/e2e/song-generation/ --debug
```

## Test Helpers

The `helpers.ts` file provides reusable utilities:

- `fillSongGenerationForm()`: Populates the song generation form
- `submitSongGeneration()`: Submits the form and captures API response
- `waitForSongGenerationResult()`: Waits for generation completion
- `verifySongResult()`: Validates displayed results

## Dependencies

- Playwright test framework
- Auth helpers from `../helpers/auth.ts`
- Test constants from `../auth/constants.ts`
- Frontend running on `http://localhost:4200`
- Backend API on `http://localhost:3000`

## Notes

- Tests run sequentially due to authentication requirements
- Each test starts with a fresh login session
- API responses are validated for correct status codes and data structure
- Form validation ensures proper user experience
- Error scenarios test resilience and user feedback
