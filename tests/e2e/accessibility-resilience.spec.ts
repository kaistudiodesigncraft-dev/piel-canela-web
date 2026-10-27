import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => window.localStorage.setItem("piel-canela-cookie-consent", "essential"));
});

test("keyboard navigation opens and closes treatment detail with focus restored", async ({ page }) => {
  await page.goto("/tratamientos");
  const opener = page.getByRole("link", { name: /ver detalles de relajación profunda/i });
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: /detalle de relajación profunda/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
});

test("public journey reflows with 200 percent text sizing", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/tratamientos");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test("reader semantics and WCAG AA remain valid at 390 and 1440 pixels", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: /principal/i })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((item) => item.impact === "serious" || item.impact === "critical"), `ancho ${width}`).toEqual([]);
  }
});

test("booking exposes a recoverable message when its server request loses the network", async ({ page }) => {
  await page.route("**/reservar**", async (route) => {
    if (route.request().method() === "POST") await route.abort("internetdisconnected");
    else await route.continue();
  });
  await page.goto("/reservar?treatmentId=treatment-relajacion");
  await expect(page.getByRole("alert", { name: /no pudimos consultar los días disponibles/i }).or(page.getByText(/no pudimos consultar los días disponibles/i))).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
});
