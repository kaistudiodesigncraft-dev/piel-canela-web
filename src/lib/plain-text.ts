const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const EMOJI_SEQUENCE_PATTERN = /[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]+/gu;

export function containsEmoji(value: string) {
  return EMOJI_PATTERN.test(value);
}

export function stripEmoji(value: string) {
  return value.replace(EMOJI_SEQUENCE_PATTERN, "").replace(/[ \t]{2,}/g, " ").trim();
}
