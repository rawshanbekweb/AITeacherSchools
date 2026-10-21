// Explicit lesson state machine (spec §6). Pure functions, shared by browser and server.
import type { Lesson, LessonSnapshot, LessonState, Position } from './types';
// A snapshot is plain JSON so it can be persisted in LessonSession and restored after a crash.

export const S = Object.freeze({
  READY: 'READY',
  CHECKING_ATTENDANCE: 'CHECKING_ATTENDANCE',
  TEACHING: 'TEACHING',
  LISTENING_FOR_QUESTION: 'LISTENING_FOR_QUESTION',
  ANSWERING: 'ANSWERING',
  CHECKING_FOLLOW_UP: 'CHECKING_FOLLOW_UP',
  KNOWLEDGE_CHECK: 'KNOWLEDGE_CHECK',
  PAUSED_BY_TEACHER: 'PAUSED_BY_TEACHER',
  RECOVERY: 'RECOVERY',
  COMPLETED: 'COMPLETED',
} as const satisfies Record<LessonState, LessonState>);

// States in which the lesson is "running" (can be paused, can lose connection).
const ACTIVE = new Set<LessonState>([
  S.CHECKING_ATTENDANCE, S.TEACHING, S.LISTENING_FOR_QUESTION, S.ANSWERING,
  S.CHECKING_FOLLOW_UP, S.KNOWLEDGE_CHECK,
]);
// States a question may interrupt; the position is saved and restored afterwards.
const INTERRUPTIBLE = new Set<LessonState>([S.TEACHING, S.KNOWLEDGE_CHECK, S.CHECKING_FOLLOW_UP]);

export function createSnapshot(lesson: Pick<Lesson, 'id' | 'sections' | 'quiz'>): LessonSnapshot {
  return {
    state: S.READY,
    lessonId: lesson.id,
    sectionCount: lesson.sections.length,
    quizCount: (lesson.quiz || []).length,
    position: { section: 0, sentence: 0, quiz: 0 },
    resume: null, // { state, position } — where to return after a question
    pausedFrom: null, // state before PAUSED_BY_TEACHER
    recoverTo: null, // state before RECOVERY
    completedSections: [],
    pendingQuestion: null,
    seq: 0,
  };
}

const clonePos = (p: Position): Position => ({ section: p.section, sentence: p.sentence, quiz: p.quiz });

/**
 * Apply an event. Returns { snapshot, changed, reason }.
 * Invalid events never throw: they are ignored with a reason, so stray voice events
 * or double clicks cannot corrupt the lesson.
 */
export type LessonEvent =
  | { type: 'START' | 'ATTENDANCE_CONFIRMED' | 'SECTION_DONE' | 'NEXT_SECTION' | 'QUESTION_REQUESTED' | 'QUESTION_CANCELLED' | 'ANSWER_DONE' | 'NO_MORE_QUESTIONS' | 'FOLLOW_UP_TIMEOUT' | 'QUIZ_ANSWERED' | 'PAUSE' | 'RESUME' | 'CONNECTION_LOST' | 'RECOVERED' | 'END' }
  | { type: 'PROGRESS'; sentence: number }
  | { type: 'QUESTION_RECEIVED'; text: string };
export type LessonEventType = LessonEvent['type'];
export interface TransitionResult { snapshot: LessonSnapshot; changed: boolean; reason?: string }

export function transition(snap: LessonSnapshot, event: LessonEvent | Exclude<LessonEventType, 'PROGRESS' | 'QUESTION_RECEIVED'>): TransitionResult {
  const ev = (typeof event === 'string' ? { type: event } : event) as LessonEvent;
  const type = ev.type;
  const s: LessonSnapshot = structuredClone(snap);
  const ignore = (reason: string): TransitionResult => ({ snapshot: snap, changed: false, reason });
  const ok = (): TransitionResult => { s.seq += 1; return { snapshot: s, changed: true }; };

  switch (type) {
    case 'START':
      if (s.state !== S.READY) return ignore('already started');
      s.state = S.CHECKING_ATTENDANCE;
      return ok();

    case 'ATTENDANCE_CONFIRMED':
      if (s.state !== S.CHECKING_ATTENDANCE) return ignore('not checking attendance');
      s.state = S.TEACHING;
      return ok();

    case 'PROGRESS': // teacher finished speaking a sentence
      if (s.state !== S.TEACHING) return ignore('not teaching');
      s.position.sentence = (ev as { sentence: number }).sentence;
      return ok();

    case 'SECTION_DONE':
    case 'NEXT_SECTION': {
      if (s.state !== S.TEACHING) return ignore('not teaching');
      if (!s.completedSections.includes(s.position.section)) s.completedSections.push(s.position.section);
      if (s.position.section + 1 < s.sectionCount) {
        s.position.section += 1;
        s.position.sentence = 0;
      } else {
        s.state = s.quizCount > 0 ? S.KNOWLEDGE_CHECK : S.COMPLETED;
      }
      return ok();
    }

    case 'QUESTION_REQUESTED':
      if (!INTERRUPTIBLE.has(s.state)) return ignore('cannot ask now');
      // Follow-up questions keep the original resume point.
      if (s.state !== S.CHECKING_FOLLOW_UP) s.resume = { state: s.state, position: clonePos(s.position) };
      s.state = S.LISTENING_FOR_QUESTION;
      return ok();

    case 'QUESTION_RECEIVED':
      if (s.state !== S.LISTENING_FOR_QUESTION) return ignore('not listening');
      {
        const text = String((ev as { text?: string }).text ?? '').trim();
        if (!text) return ignore('empty question');
        s.pendingQuestion = text;
      }
      s.state = S.ANSWERING;
      return ok();

    case 'QUESTION_CANCELLED': // e.g. false wake-word detection
      if (s.state !== S.LISTENING_FOR_QUESTION) return ignore('not listening');
      return backToResume(s, ok);

    case 'ANSWER_DONE':
      if (s.state !== S.ANSWERING) return ignore('not answering');
      s.pendingQuestion = null;
      s.state = S.CHECKING_FOLLOW_UP;
      return ok();

    case 'NO_MORE_QUESTIONS':
    case 'FOLLOW_UP_TIMEOUT':
      if (s.state !== S.CHECKING_FOLLOW_UP) return ignore('not checking follow-up');
      return backToResume(s, ok);

    case 'QUIZ_ANSWERED':
      if (s.state !== S.KNOWLEDGE_CHECK) return ignore('not in knowledge check');
      s.position.quiz += 1;
      if (s.position.quiz >= s.quizCount) s.state = S.COMPLETED;
      return ok();

    case 'PAUSE':
      if (!ACTIVE.has(s.state)) return ignore('nothing to pause');
      s.pausedFrom = s.state;
      s.state = S.PAUSED_BY_TEACHER;
      return ok();

    case 'RESUME':
      if (s.state !== S.PAUSED_BY_TEACHER) return ignore('not paused');
      s.state = s.pausedFrom ?? S.TEACHING;
      s.pausedFrom = null;
      return ok();

    case 'CONNECTION_LOST':
      if (!ACTIVE.has(s.state) && s.state !== S.PAUSED_BY_TEACHER) return ignore('not running');
      s.recoverTo = s.state;
      s.state = S.RECOVERY;
      return ok();

    case 'RECOVERED':
      if (s.state !== S.RECOVERY) return ignore('not recovering');
      s.state = s.recoverTo ?? S.TEACHING;
      s.recoverTo = null;
      return ok();

    case 'END':
      if (s.state === S.COMPLETED) return ignore('already completed');
      s.state = S.COMPLETED;
      return ok();

    default:
      return ignore('unknown event ' + String(type));
  }
}

function backToResume(s: LessonSnapshot, ok: () => TransitionResult): TransitionResult {
  const r = s.resume;
  s.resume = null;
  s.pendingQuestion = null;
  s.state = r ? r.state : S.TEACHING;
  // CHECKING_FOLLOW_UP is never a resume target; it can only come from an earlier question.
  if (s.state === S.CHECKING_FOLLOW_UP) s.state = S.TEACHING;
  if (r) s.position = clonePos(r.position);
  return ok();
}

export const isActive = (state: LessonState) => ACTIVE.has(state);
