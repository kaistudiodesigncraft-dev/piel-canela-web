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
  await page.goto("/admin/catalogo");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: /panel/i })).toBeVisible();
});
