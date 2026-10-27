import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const managerEmail = process.env.E2E_MANAGER_EMAIL;
const managerPassword = process.env.E2E_MANAGER_PASSWORD;

test.describe("manager workflow", () => {
  test.skip(!managerEmail || !managerPassword, "Requiere credenciales E2E de manager en un entorno aislado o de preview.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Correo").fill(managerEmail!);
    await page.getByLabel("Contraseña").fill(managerPassword!);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/admin(?:\?|$)/);
  });

  test("manager can inspect operational modules without owner access", async ({ page }) => {
    for (const route of ["/admin/catalogo", "/admin/profesionales", "/admin/manual", "/admin/historial"]) {
      await page.goto(route);
      await expect(page.getByRole("navigation", { name: "Navegación administrativa" }).first()).toBeVisible();
      await expect(page.locator(".form-message--error")).toHaveCount(0);
    }
    await page.goto("/admin/seguridad");
    await expect(page).toHaveURL(/\/admin\?error=permission/);
  });

  test("content preview uses exact public widths and stays accessible", async ({ page }) => {
    await page.goto("/admin/contenido");
    const preview = page.locator(".content-preview-frame").first();
    await expect(preview).toHaveCSS("width", "390px");
    await page.getByRole("button", { name: "1440 px" }).first().click();
    await expect(preview).toHaveCSS("width", "1440px");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  });

  test("mobile menu traps the task and restores focus on close", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/manual");
    const trigger = page.getByRole("button", { name: "Menú del panel" });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Piel Canela" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
});
