/** React actions reset uncontrolled controls after returning, including validation errors.
 * Keep the submitted values as reset defaults; successful actions navigate away.
 * File controls cannot be restored and are deliberately excluded.
 */
export function preserveSubmittedForm(form: HTMLFormElement) {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement) {
      if (element.type === "file") continue;
      if (element.type === "checkbox" || element.type === "radio") element.defaultChecked = element.checked;
      else element.defaultValue = element.value;
    } else if (element instanceof HTMLTextAreaElement) {
      element.defaultValue = element.value;
    } else if (element instanceof HTMLSelectElement) {
      const selected = Array.from(element.options).map((option) => option.selected);
      Array.from(element.options).forEach((option, index) => { option.defaultSelected = selected[index] ?? false; });
    }
  }
}
