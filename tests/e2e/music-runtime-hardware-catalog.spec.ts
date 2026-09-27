import {
  expect,
  test,
} from '@playwright/test';

import {
  loginViaModal,
} from './helpers/auth';

type CatalogModel = {
  id: string;
  providerId: string;
  name: string;
  availability:
    | 'installed'
    | 'planned'
    | 'api-only'
    | 'unreleased';
  hardwareFit:
    | 'recommended'
    | 'supported'
    | 'experimental'
    | 'unsupported';
  selectable: boolean;
  disabledReason: string | null;
};

type CatalogProvider = {
  id: string;
  name: string;
};

type Catalog = {
  hardware: {
    gpuAvailable: boolean;
    gpuName: string | null;
    vramTotalGb: number | null;
  };
  providers: CatalogProvider[];
  models: CatalogModel[];
};

function fitLabel(
  fit: CatalogModel['hardwareFit']
): string {
  switch (fit) {
    case 'recommended':
      return 'Recommended';
    case 'supported':
      return 'Supported';
    case 'experimental':
      return 'Experimental';
    default:
      return 'Unavailable';
  }
}

test.describe(
  'music runtime hardware catalog',
  () => {
    test.setTimeout(120_000);

    test(
      'UI exposes all tiers and disables models the live catalog marks non-selectable',
      async ({ page }) => {
        const username =
          process.env
            .E2E_TEST_USER_USERNAME ||
          'test-user';

        const password =
          process.env
            .E2E_TEST_USER_PASSWORD ||
          'password';

        await page.goto('/');

        await loginViaModal(
          page,
          {
            emailOrUsername:
              username,
            password,
          }
        );

        await page.goto(
          '/generate/music'
        );

        const catalog =
          await page.evaluate(
            async () => {
              const response =
                await fetch(
                  '/api/music/runtime/catalog'
                );

              if (!response.ok) {
                throw new Error(
                  `catalog returned ${response.status}`
                );
              }

              return response.json();
            }
          ) as Catalog;

        if (
          catalog.hardware
            .gpuName
        ) {
          await expect(
            page.getByText(
              catalog.hardware
                .gpuName,
              {
                exact: true,
              }
            )
          ).toBeVisible();
        }

        for (
          const provider of
          catalog.providers
        ) {
          const providerSelect =
            page
              .locator(
                '.runtime-selectors mat-form-field'
              )
              .nth(0)
              .locator(
                'mat-select'
              );

          await providerSelect.click();

          await page
            .getByRole(
              'option',
              {
                name:
                  new RegExp(
                    provider.name
                      .replace(
                        /[.*+?^${}()|[\]\\]/g,
                        '\\$&'
                      )
                  ),
              }
            )
            .click();

          const providerModels =
            catalog.models.filter(
              (model) =>
                model.providerId ===
                provider.id
            );

          if (
            providerModels.length ===
            0
          ) {
            continue;
          }

          const modelSelect =
            page
              .locator(
                '.runtime-selectors mat-form-field'
              )
              .nth(1)
              .locator(
                'mat-select'
              );

          await modelSelect.click();

          for (
            const model of
            providerModels
          ) {
            const options =
              page.getByRole(
                'option'
              );

            const matchingIndexes =
              await options.evaluateAll(
                (elements, expectedName) =>
                  elements
                    .map((element, index) => ({
                      index,
                      label:
                        element
                          .querySelector('span')
                          ?.textContent
                          ?.trim() || '',
                    }))
                    .filter(
                      (entry) =>
                        entry.label ===
                          expectedName ||
                        entry.label.startsWith(
                          `${expectedName} ·`
                        )
                    )
                    .map(
                      (entry) =>
                        entry.index
                    ),
                model.name
              );

            expect(
              matchingIndexes,
              `expected exactly one option for ${model.name}`
            ).toHaveLength(1);

            const option =
              options.nth(
                matchingIndexes[0]
              );

            await expect(
              option
            ).toBeVisible();

            await expect(
              option
            ).toContainText(
              fitLabel(
                model.hardwareFit
              )
            );

            if (
              !model.selectable
            ) {
              await expect(
                option
              ).toHaveAttribute(
                'aria-disabled',
                'true'
              );

              if (
                model
                  .disabledReason
              ) {
                await expect(
                  option
                ).toContainText(
                  model
                    .disabledReason
                );
              }
            }
          }

          await page.keyboard.press(
            'Escape'
          );
        }
      }
    );
  }
);
