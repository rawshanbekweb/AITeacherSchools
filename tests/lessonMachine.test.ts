import { test } from 'vitest';
import type { LessonSnapshot } from '@/lib/core/types';
import assert from 'node:assert/strict';
import { S, createSnapshot, transition } from '@/lib/core/lessonMachine';

const q = { q: 'q', options: ['a', 'b'], answer: 0 };
const lesson = { id: 'l1', sections: [{ title: 'A', sentences: ['a', 'b'] }, { title: 'B', sentences: ['c'] }], quiz: [q, q] };
const run = (snap: LessonSnapshot, ...events: Parameters<typeof transition>[1][]) => events.reduce((s, e) => transition(s, e).snapshot, snap);

test('happy path: attendance → teaching → quiz → completed', () => {
  let s = run(createSnapshot(lesson), 'START', 'ATTENDANCE_CONFIRMED');
  assert.equal(s.state, S.TEACHING);
  s = run(s, { type: 'PROGRESS', sentence: 2 }, 'SECTION_DONE');
  assert.deepEqual(s.position, { section: 1, sentence: 0, quiz: 0 });
  s = run(s, 'SECTION_DONE');
  assert.equal(s.state, S.KNOWLEDGE_CHECK);
  assert.deepEqual(s.completedSections, [0, 1]);
  s = run(s, 'QUIZ_ANSWERED', 'QUIZ_ANSWERED');
  assert.equal(s.state, S.COMPLETED);
});

test('question pauses the lesson and resumes from the saved position (Appendix A)', () => {
  let s = run(createSnapshot(lesson), 'START', 'ATTENDANCE_CONFIRMED', { type: 'PROGRESS', sentence: 1 });
  s = run(s, 'QUESTION_REQUESTED');
  assert.equal(s.state, S.LISTENING_FOR_QUESTION);
  assert.deepEqual(s.resume, { state: S.TEACHING, position: { section: 0, sentence: 1, quiz: 0 } });
  s = run(s, { type: 'QUESTION_RECEIVED', text: 'Nega?' });
  assert.equal(s.state, S.ANSWERING);
  assert.equal(s.pendingQuestion, 'Nega?');
  s = run(s, 'ANSWER_DONE');
  assert.equal(s.state, S.CHECKING_FOLLOW_UP);
  // follow-up question keeps the original resume point
  s = run(s, 'QUESTION_REQUESTED', { type: 'QUESTION_RECEIVED', text: 'Yana?' }, 'ANSWER_DONE', 'NO_MORE_QUESTIONS');
  assert.equal(s.state, S.TEACHING);
  assert.deepEqual(s.position, { section: 0, sentence: 1, quiz: 0 });
  assert.equal(s.resume, null);
});

test('follow-up timeout continues the lesson', () => {
  const s = run(createSnapshot(lesson), 'START', 'ATTENDANCE_CONFIRMED', 'QUESTION_REQUESTED', { type: 'QUESTION_RECEIVED', text: 'x' }, 'ANSWER_DONE', 'FOLLOW_UP_TIMEOUT');
  assert.equal(s.state, S.TEACHING);
});

test('questions during the knowledge check return to the same quiz item', () => {
  let s = run(createSnapshot(lesson), 'START', 'ATTENDANCE_CONFIRMED', 'SECTION_DONE', 'SECTION_DONE', 'QUIZ_ANSWERED');
  s = run(s, 'QUESTION_REQUESTED', { type: 'QUESTION_RECEIVED', text: 'x' }, 'ANSWER_DONE', 'NO_MORE_QUESTIONS');
  assert.equal(s.state, S.KNOWLEDGE_CHECK);
  assert.equal(s.position.quiz, 1);
});

test('double start and stray events are ignored, not fatal', () => {
  const s = run(createSnapshot(lesson), 'START');
  const r = transition(s, 'START');
  assert.equal(r.changed, false);
  assert.equal(transition(s, 'ANSWER_DONE').changed, false);
  assert.equal(transition(s, { type: 'QUESTION_RECEIVED', text: 'x' }).changed, false);
});

test('empty recognised question is rejected; false wake word can be cancelled', () => {
  let s = run(createSnapshot(lesson), 'START', 'ATTENDANCE_CONFIRMED', { type: 'PROGRESS', sentence: 1 }, 'QUESTION_REQUESTED');
  assert.equal(transition(s, { type: 'QUESTION_RECEIVED', text: '   ' }).changed, false);
  s = run(s, 'QUESTION_CANCELLED');
  assert.equal(s.state, S.TEACHING);
  assert.equal(s.position.sentence, 1);
});

test('pause and recovery restore the exact previous state', () => {
  let s = run(createSnapshot(lesson), 'START', 'ATTENDANCE_CONFIRMED', 'QUESTION_REQUESTED', 'PAUSE');
  assert.equal(s.state, S.PAUSED_BY_TEACHER);
  s = run(s, 'RESUME');
  assert.equal(s.state, S.LISTENING_FOR_QUESTION);
  s = run(s, 'CONNECTION_LOST');
  assert.equal(s.state, S.RECOVERY);
  s = run(s, 'RECOVERED');
  assert.equal(s.state, S.LISTENING_FOR_QUESTION);
  assert.deepEqual(s.resume!.position, { section: 0, sentence: 0, quiz: 0 });
});

test('teacher can end the lesson at any time', () => {
  const s = run(createSnapshot(lesson), 'START', 'END');
  assert.equal(s.state, S.COMPLETED);
  assert.equal(transition(s, 'END').changed, false);
});
