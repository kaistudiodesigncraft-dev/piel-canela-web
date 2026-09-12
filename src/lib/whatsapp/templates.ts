import { MESSAGE_VARIABLES, type MessageEvent, type MessageTemplates, type MessageValues } from "@/domain/whatsapp";

export const DEFAULT_MESSAGE_TEMPLATES: Record<MessageEvent, string> = {
  pre_reservation: "Hola, quiero confirmar mi pre-reserva en Piel Canela.\nNombre: {{nombre}}\nTratamiento: {{tratamiento}}\nCombo: {{combo}}\nFecha: {{fecha}} a las {{hora}}\nDuración: {{duracion}}\nCódigo: {{codigo}}\n{{sena}}",
  confirmation: "Hola {{nombre}}, tu turno en Piel Canela está confirmado.\n{{tratamiento}} · {{combo}}\n{{fecha}} a las {{hora}} · {{duracion}}\nReserva: {{codigo}}\nDirección: {{direccion}}",
  preparation: "Hola {{nombre}}, te recordamos tu turno de {{tratamiento}} en Piel Canela.\n{{fecha}} a las {{hora}}\nCódigo: {{codigo}}\nDirección: {{direccion}}",
};

export function validateTemplate(body: string): string | null {
  if (body.trim().length < 10 || body.length > 1800) return "Usá entre 10 y 1800 caracteres.";
  const tokens = [...body.matchAll(/\{\{([^{}]+)\}\}/g)];
  if (tokens.some(([, key]) => !key || !(MESSAGE_VARIABLES as readonly string[]).includes(key))) return "El mensaje contiene una variable no permitida.";
  if (body.replace(/\{\{[^{}]+\}\}/g, "").match(/[{}]/)) return "Revisá las llaves de las variables.";
  return null;
}

export function resolveWhatsAppMessage(event: MessageEvent, overrides: MessageTemplates, values: MessageValues) {
  const candidate = overrides[event];
  const body = candidate && !validateTemplate(candidate) ? candidate : DEFAULT_MESSAGE_TEMPLATES[event];
  return body.replace(/\{\{([^{}]+)\}\}/g, (_, key: keyof MessageValues) => values[key]);
}

export function normalizeWhatsAppPhone(phone: string): string | null {
  const digits = phone.trim().replace(/[\s()+.-]/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
