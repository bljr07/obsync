import { expect, test } from "@playwright/test";

async function mockApi(page: any) {
  let metricsHits = 0;

  await page.route("**/api/v1/vaults/*/observability/metrics", async (route: any) => {
    metricsHits += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totalFiles: metricsHits === 1 ? 12 : 99,
        totalVersions: 34,
        totalBytes: 56
      })
    });
  });

  await page.route("**/api/v1/vaults/*/observability/conflicts", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [{ id: "c1", path: "work/notes.md", baseHash: "deadbeef", latestHash: "ff", createdAt: "2024-01-01" }]
      })
    });
  });

  await page.route("**/api/v1/vaults/*/observability/presence", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [{ path: "work/notes.md", activeCount: 2 }] })
    });
  });

  await page.route("**/api/v1/vaults/*/observability/logs", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "l1",
            path: "work/notes.md",
            action: "created",
            message: "File created",
            createdAt: "2024-01-01"
          }
        ]
      })
    });
  });

  await page.route("**/api/v1/vaults/*/admin/retention", async (route: any) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ retentionDays: 21 })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ retentionDays: 14 })
    });
  });

  await page.route("**/api/v1/vaults/*/admin/retention/run", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        retentionDays: 14,
        cutoff: "2024-01-01T00:00:00.000Z",
        versionsDeleted: 2,
        conflictsDeleted: 1
      })
    });
  });

  await page.route("**/api/v1/vaults/*/admin/api-keys", async (route: any) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "k2",
          name: "New",
          role: "client",
          prefix: "obsync_",
          createdAt: "",
          apiKey: "obsync_key"
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [{ id: "k1", name: "Key", role: "client", prefix: "obsync_" }]
      })
    });
  });

  await page.route("**/api/v1/vaults/*/admin/api-keys/*/revoke", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true })
    });
  });

  await page.route("**/api/v1/auth/me", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        userId: "u1",
        username: "admin",
        role: "admin",
        vaultId: "vault-1",
        mustChangePassword: false
      })
    });
  });
}

test("loads the observability dashboard", async ({ page }) => {
  await mockApi(page);
  const metricsResponse = page.waitForResponse((response) =>
    response.url().includes("/observability/metrics") && response.request().method() === "GET"
  );
  await page.goto("/");
  await metricsResponse;

  const totalFilesValue = page
    .locator(".panel.metric", { hasText: "Total files" })
    .locator(".metric-value");

  await expect(page.getByText("Obsync Console")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vault observability and control" })).toBeVisible();
  await expect(page.getByLabel("Server URL")).toBeVisible();
  await expect(page.getByLabel("Vault ID")).toBeVisible();
  await expect(totalFilesValue).toHaveText(/\d+/);
  await expect(page.getByText("deadbeef")).toBeVisible();
  await expect(page.getByText("File created")).toBeVisible();
});

test("refresh updates metrics", async ({ page }) => {
  await mockApi(page);
  const firstMetrics = page.waitForResponse((response) =>
    response.url().includes("/observability/metrics") && response.request().method() === "GET"
  );
  await page.goto("/");
  await firstMetrics;

  const totalFilesValue = page
    .locator(".panel.metric", { hasText: "Total files" })
    .locator(".metric-value");

  await expect(totalFilesValue).toHaveText(/\d+/);

  const nextMetrics = page.waitForResponse((response) =>
    response.url().includes("/observability/metrics") && response.request().method() === "GET"
  );
  await page.getByRole("button", { name: "Refresh" }).click();
  await nextMetrics;

  await expect(totalFilesValue).toHaveText("99");
});

test("retention and api key actions", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await page.getByLabel("Retention days").fill("21");
  await page.getByRole("button", { name: "Update" }).click();

  await page.getByRole("button", { name: "Run now" }).click();
  await expect(page.getByText(/Deleted 2 versions/)).toBeVisible();

  await page.getByLabel("Key name").fill("New");
  await page.getByRole("button", { name: "Create key" }).click();
  await expect(page.getByText(/New key:/)).toBeVisible();

  await page.getByRole("button", { name: "Revoke" }).click();
});
