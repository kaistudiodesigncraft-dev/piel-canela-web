import { expect, test } from "@playwright/test";

test("home remains readable across viewports with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const visual = page.locator("[data-hero-visual]");
    await expect(visual).toHaveCSS("transform", "none");
  }
});

test("contact links reach information pages and missing route returns 404", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacidad", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Privacidad");
  await page.goto("/condiciones-de-reserva");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const response = await page.goto("/pagina-inexistente-qa");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
