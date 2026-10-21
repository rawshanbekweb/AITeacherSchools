import { expect, test } from 'vitest';
import { gestureForSentence } from '@/lib/core/gestures';

test('sentences pick fitting body language', () => {
  const never = () => 1;
  expect(gestureForSentence('Qarang, bu — kamalak!', { rand: never })).toBe('point');
  expect(gestureForSentence('Ko‘k — xuddi osmon kabi. Barakalla!', { rand: never })).toBe('praise');
  expect(gestureForSentence('Посмотрите на схему.', { rand: never })).toBe('point');
  expect(gestureForSentence('Nima uchun?', { rand: never })).toBe('explain');
  expect(gestureForSentence('Oddiy gap.', { sectionStart: true, rand: never })).toBe('explain');
  expect(gestureForSentence('Oddiy gap.', { rand: never })).toBeNull();
  expect(gestureForSentence('Oddiy gap.', { rand: () => 0 })).toBe('explain');
});
