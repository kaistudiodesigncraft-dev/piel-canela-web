import { expect, test } from "@playwright/test";

test("privacy choices remain fully visible on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const consent = page.getByLabel("Preferencias de privacidad y medición");
  await expect(consent).toBeVisible();
  for (const button of ["Solo necesarias", "Aceptar medición"]) {
    const box = await consent.getByRole("button", { name: button }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("compact treatment selectors reserve readable space inside a desktop drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const dimensions = await page.evaluate(() => {
    const host = document.createElement("div");
    host.className = "treatment-dialog";
    host.style.position = "fixed";
    host.style.inset = "0 0 0 auto";
    host.innerHTML = `<article class="treatment-detail treatment-detail--compact"><section class="combo-selector"><div class="combo-selector__layout"><div class="combo-selector__options">Opciones</div><aside class="combo-selection-summary">Resumen</aside></div></section></article>`;
    document.body.append(host);
    const options = host.querySelector<HTMLElement>(".combo-selector__options")!;
    const summary = host.querySelector<HTMLElement>(".combo-selection-summary")!;
    const result = {
      options: options.getBoundingClientRect().width,
      summary: summary.getBoundingClientRect().width,
      host: host.getBoundingClientRect().width,
    };
    host.remove();
    return result;
  });
  expect(dimensions.host).toBeGreaterThanOrEqual(640);
  expect(dimensions.options).toBeGreaterThanOrEqual(300);
  expect(dimensions.summary).toBeLessThanOrEqual(260);
});
