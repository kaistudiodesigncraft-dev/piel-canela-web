import { describe, expect, it } from "vitest";
import { normalizeWhatsAppPhone, resolveWhatsAppMessage, validateTemplate } from "./templates";
import { createHmac } from "node:crypto";
import { secretsMatch, validWebhookSignature } from "./security";
const values = { nombre: "Ana", tratamiento: "Masaje", combo: "Compartido", fecha: "20/09", hora: "15:00", duracion: "60 min", codigo: "PC-123", direccion: "Dirección", sena: "A confirmar" };
describe("WhatsApp message safety", () => {
  it("resolves approved variables without evaluating customer input", () => {
    expect(resolveWhatsAppMessage("confirmation", { confirmation: "Hola {{nombre}}, {{combo}}" }, values)).toBe("Hola Ana, Compartido");
    expect(resolveWhatsAppMessage("confirmation", { confirmation: "Hola {{nombre}}" }, { ...values, nombre: "{{codigo}}" })).toBe("Hola {{codigo}}");
  });
  it("rejects unknown, broken and oversized templates", () => {
    expect(validateTemplate("Hola {{internal_notes}}")).not.toBeNull();
    expect(validateTemplate("Hola {{nombre}")).not.toBeNull();
    expect(validateTemplate("x".repeat(1801))).not.toBeNull();
  });
  it("falls back without including private fields", () => {
    expect(resolveWhatsAppMessage("confirmation", { confirmation: "{{secret}}" }, values)).toContain("Ana");
  });
  it("validates international numbers", () => {
    expect(normalizeWhatsAppPhone("+54 9 (351) 123-4567")).toBe("5493511234567");
    expect(normalizeWhatsAppPhone("011 abc 1234")).toBeNull();
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });
  it("rejects missing secrets and tampered webhook signatures", () => {
    expect(secretsMatch(null, undefined)).toBe(false);
    expect(secretsMatch("short", "short")).toBe(false);
    const body = '{"entry":[]}'; const secret = "a".repeat(32);
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(validWebhookSignature(body, signature, secret)).toBe(true);
    expect(validWebhookSignature(`${body} `, signature, secret)).toBe(false);
  });
});
