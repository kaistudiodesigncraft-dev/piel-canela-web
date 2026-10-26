import type { KeyboardEvent } from "react";

/**
 * Forms with multiple publication states must not choose an action implicitly.
 * Keyboard users can still tab to the explicit button and activate it with Enter.
 */
export function preventImplicitFormSubmit(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter" || event.defaultPrevented) return;
  if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) return;
  event.preventDefault();
}
