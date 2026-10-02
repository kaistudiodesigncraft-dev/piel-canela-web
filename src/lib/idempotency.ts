/** Creates a deterministic UUID-shaped key from React's hydration-stable useId value. */
export function idempotencyUuid(seed: string): string {
  let state = 2166136261;
  let hex = "";
  for (let block = 0; block < 4; block += 1) {
    for (let index = 0; index < seed.length; index += 1) {
      state ^= seed.charCodeAt(index) + block;
      state = Math.imul(state, 16777619);
    }
    hex += (state >>> 0).toString(16).padStart(8, "0");
  }
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
