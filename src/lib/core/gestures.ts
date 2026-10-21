import type { GestureKind } from './types';

// Body language for a spoken sentence. Pure so it can be unit-tested; `rand` is injectable.
// JS \b is ASCII-only, so word edges are written with Unicode letter lookarounds.
const POINT = /(?<!\p{L})(qarang|mana|bu yerda|rasmda|ekranda|doskada|sxemada|chizmada|смотрите|посмотрите|на экране|на схеме|look|here)(?!\p{L})/iu;
const PRAISE = /(barakalla|ofarin|zo‘r|молод|отлично|прекрасно|well done|great job)/iu;

export function gestureForSentence(sentence: string, opts: { sectionStart?: boolean; charisma?: number; rand?: () => number } = {}): GestureKind | null {
  const rand = opts.rand ?? Math.random;
  const ch = opts.charisma ?? 0.7;
  if (PRAISE.test(sentence)) return 'praise';
  if (POINT.test(sentence)) return 'point';
  if (opts.sectionStart) return 'explain';
  if (/\?\s*$/.test(sentence)) return 'explain';
  return rand() < 0.1 + 0.25 * ch ? 'explain' : null;
}
