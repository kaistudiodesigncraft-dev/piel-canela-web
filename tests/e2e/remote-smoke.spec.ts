import { expect, test } from "@playwright/test";

test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Solo se ejecuta contra un preview indicado explícitamente.");

test("remote preview is readable without mutating production", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/tratamientos");
  await expect(page.getByRole("heading", { name: /tratamiento adecuado/i })).toBeVisible();

  await page.goto("/admin/catalogo");
  await expect(page).toHaveURL(/\/admin\/login/);
});
