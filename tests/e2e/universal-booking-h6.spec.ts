import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const fixtures = {
  simple: {
    slug: "h6-simple-qa",
    expectedTotal: "$ 15.000",
    expectedDuration: "30 minutos",
  },
  options: {
    slug: "h6-opciones-qa",
    expectedTotal: "$ 12.000",
    expectedDuration: "45 minutos",
  },
  closed: {
    slug: "h6-combos-cerrados-qa",
    expectedTotal: "$ 8.500",
    expectedDuration: "35 minutos",
  },
  addons: {
    slug: "h6-combos-adicionales-qa",
    expectedTotal: "$ 14.200",
    expectedDuration: "45 minutos",
  },
} as const;

type FixtureName = keyof typeof fixtures;
let localNetworkIndex = 10;

async function beginConfiguredBooking(page: Page, fixtureName: FixtureName) {
  const fixture = fixtures[fixtureName];
  await page.goto(`/tratamientos/${fixture.slug}`);

  if (fixtureName === "simple") {
    await page.getByRole("link", { name: "Iniciar reserva", exact: true }).click();
  } else {
    if (fixtureName === "options") {
      await page.getByRole("checkbox", { name: /Opción Alfa/ }).check();
      await page.getByRole("checkbox", { name: /Opción Beta/ }).check();
    }
    if (fixtureName === "closed") {
      await page.getByRole("radio", { name: /Combo Cerrado H6/ }).check();
    }
    if (fixtureName === "addons") {
      await page.getByRole("radio", { name: /Combo con Adicionales H6/ }).check();
      await page.getByRole("checkbox", { name: /Adicional Uno/ }).check();
      await page.getByRole("checkbox", { name: /Adicional Dos/ }).check();
      await expect(page.getByText("Descuento (10 %)", { exact: true })).toBeVisible();
      await expect(page.getByText("−$ 800", { exact: true })).toBeVisible();
    }
    await page.getByRole("link", { name: "Elegir fecha y horario", exact: true }).click();
  }

  await expect(page.getByRole("heading", { name: /Elegí cuándo querés venir/i })).toBeVisible();
  await expect(page.getByRole("complementary", { name: /Resumen del tratamiento/i })).toContainText(
    fixture.expectedTotal,
  );
  await expect(page.getByRole("complementary", { name: /Resumen del tratamiento/i })).toContainText(
    fixture.expectedDuration,
  );
}

async function completeBooking(page: Page, fixtureName: FixtureName, label: string) {
  // Each local E2E case represents an independent visitor. This also proves
  // the production abuse guard without disabling or weakening it for tests.
  localNetworkIndex += 1;
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.100.${localNetworkIndex}`,
  });
  await beginConfiguredBooking(page, fixtureName);
  const availableTimes = page.locator(".time-choice-grid .time-choice");
  await expect(availableTimes.first()).toBeVisible({ timeout: 15_000 });
  await availableTimes.first().click();
  await expect(availableTimes.first()).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();

  await page.getByRole("textbox", { name: "Nombre y apellido" }).fill(`QA H6 E2E ${label}`);
  await page.getByRole("textbox", { name: "WhatsApp" }).fill("3510000099");
  await page.getByRole("button", { name: "Revisar reserva" }).click();
  await page.getByRole("button", { name: "Crear pre-reserva" }).click();
  await expect(page.getByText("Pre-reserva creada", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Continuar por WhatsApp" })).toHaveAttribute(
    "href",
    /wa\.me\/5493517677404\?text=/,
  );
}

test.describe.serial("H6 universal booking acceptance", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("piel-canela-cookie-consent", "essential");
    });
  });

  for (const viewport of [
    { width: 375, height: 812, name: "375" },
    { width: 768, height: 1024, name: "768" },
    { width: 1440, height: 1000, name: "1440" },
  ]) {
    for (const fixtureName of Object.keys(fixtures) as FixtureName[]) {
      test(`${fixtureName} completes at ${viewport.name}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await completeBooking(page, fixtureName, `${fixtureName}-${viewport.name}`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
  }

  for (const fixtureName of Object.keys(fixtures) as FixtureName[]) {
    test(`${fixtureName} has visible keyboard focus and no serious AA violation`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/tratamientos/${fixtures[fixtureName].slug}`);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(serious, serious.map((item) => item.id).join(", ")).toEqual([]);
    });
  }
});
