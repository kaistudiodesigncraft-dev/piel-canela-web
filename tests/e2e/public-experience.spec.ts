import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("catalog filters, opens a shareable detail and restores focus", async ({ page }) => {
  await page.goto("/tratamientos");

  await page.getByRole("link", { name: "Bienestar", exact: true }).click();
  await expect(page).toHaveURL(/category=bienestar/);
  await expect(page.getByRole("heading", { name: "Bienestar", level: 2 })).toBeVisible();

  const opener = page.getByRole("link", { name: /ver detalles de relajación profunda/i });
  await opener.click();
  await expect(page).toHaveURL(/treatment=relajacion-profunda/);

  const dialog = page.getByRole("dialog", { name: /detalle de relajación profunda/i });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/treatment=/);
  await expect(opener).toBeFocused();
});

test("booking entry preserves the selected treatment", async ({ page }) => {
  await page.goto("/reservar?treatmentId=treatment-relajacion");

  await expect(page.getByRole("complementary", { name: /resumen del tratamiento/i })).toContainText(
    "Relajación profunda",
  );
  await expect(page.getByRole("heading", { name: /elegí cuándo querés venir/i })).toBeVisible();
});

test("public routes have no serious automated accessibility violations", async ({ page }) => {
  for (const route of ["/", "/tratamientos", "/reservar?treatmentId=treatment-relajacion"]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const serious = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, `${route}: ${serious.map((item) => item.id).join(", ")}`).toEqual([]);
  }
});

test("administrative routes remain protected without a session", async ({ page }) => {
  for (const route of ["/admin/catalogo", "/admin/mensajes", "/admin/mi-cuenta"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /panel/i })).toBeVisible();
  }
});

test("recovery entry remains accessible at 320px without sending email", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  // Fixture mode deliberately omits the email action and its login shortcut.
  await page.goto("/auth/recuperar");
  await expect(page.getByRole("heading", { name: "Recuperá tu acceso" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("link", { name: "Volver al ingreso" })).toBeVisible();
});
