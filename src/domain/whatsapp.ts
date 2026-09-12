export const MESSAGE_EVENTS = ["pre_reservation", "confirmation", "preparation"] as const;
export type MessageEvent = (typeof MESSAGE_EVENTS)[number];
export const MESSAGE_VARIABLES = ["nombre", "tratamiento", "combo", "fecha", "hora", "duracion", "codigo", "direccion", "sena"] as const;
export type MessageValues = Record<(typeof MESSAGE_VARIABLES)[number], string>;
export type MessageTemplates = Partial<Record<MessageEvent, string>>;
