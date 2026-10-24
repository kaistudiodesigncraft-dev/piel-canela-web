const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

export function containsEmoji(value: string) {
  return EMOJI_PATTERN.test(value);
}
