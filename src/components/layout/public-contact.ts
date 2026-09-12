/** Contact destinations must remain data, never executable URLs or mail headers. */
export function publicEmailLink(value: string | null) {
  const email = value?.trim();
  return email && /^[^\s@?&#%]+@[^\s@?&#%]+\.[^\s@?&#%]+$/.test(email) ? `mailto:${email}` : null;
}

export function publicWhatsAppLink(value: string | null) {
  if (!value || !/^[+\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? `https://wa.me/${digits}` : null;
}

export function publicInstagramLink(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["instagram.com", "www.instagram.com"].includes(url.hostname)
      ? url.href : null;
  } catch { return null; }
}
