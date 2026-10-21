// Domain types shared by server and client.

export type Role = 'super_admin' | 'inst_admin' | 'director' | 'teacher' | 'student' | 'technician';
export type InstitutionType = 'kindergarten' | 'school' | 'university';
export type Lang = 'uz' | 'ru' | 'en';

export interface Landmarks {
  eyeL: [number, number];
  eyeR: [number, number];
  eyeW: number;
  eyeH: number;
  mouthL: [number, number];
  mouthC: [number, number];
  mouthR: [number, number];
  chin: [number, number];
  neck: [number, number];
}

export type GestureKind = 'idle' | 'welcome' | 'explain' | 'point' | 'think' | 'praise' | 'listen';
export const GESTURE_KINDS: GestureKind[] = ['idle', 'welcome', 'explain', 'point', 'think', 'praise', 'listen'];

/** Face landmarks per video frame, sampled at `fps` (from the Avatar studio tracker). */
export interface LandmarkTrack { fps: number; frames: Landmarks[] }

/** One recorded pose or gesture of the teacher: a still photo or a short video clip. */
export interface AvatarPose {
  id: string;
  name: string;
  kind: GestureKind;
  media: 'image' | 'video';
  src: string;
  landmarks: Landmarks;
  track?: LandmarkTrack;
  /** green/blue-screen key for videos filmed against a plain backdrop */
  chroma?: { color: [number, number, number]; tolerance: number } | null;
}

export interface AvatarConfig {
  name: string;
  /** base idle photo (always present) */
  image: string;
  landmarks: Landmarks;
  voiceGender: 'male' | 'female';
  charisma: number;
  /** optional gesture library: extra photos / video clips with hand movements */
  poses?: AvatarPose[];
}

export interface LessonSection {
  title: string;
  materialId?: string;
  sentences: string[];
}
export interface QuizItem {
  q: string;
  options: string[];
  answer: number;
  explain?: string;
}
export interface FaqItem {
  keys: string[];
  a: string;
}

export interface Lesson {
  id: string;
  institutionId: string;
  subjectId: string | null;
  title: string;
  language: string;
  durationMin: number;
  status: 'draft' | 'published';
  greeting: string;
  sections: LessonSection[];
  quiz: QuizItem[];
  faq: FaqItem[];
  sampleQuestions: string[];
  groupIds: string[];
}

export interface Position {
  section: number;
  sentence: number;
  quiz: number;
}

export interface LessonSnapshot {
  state: LessonState;
  lessonId: string;
  sectionCount: number;
  quizCount: number;
  position: Position;
  resume: { state: LessonState; position: Position } | null;
  pausedFrom: LessonState | null;
  recoverTo: LessonState | null;
  completedSections: number[];
  pendingQuestion: string | null;
  seq: number;
}

export type LessonState =
  | 'READY'
  | 'CHECKING_ATTENDANCE'
  | 'TEACHING'
  | 'LISTENING_FOR_QUESTION'
  | 'ANSWERING'
  | 'CHECKING_FOLLOW_UP'
  | 'KNOWLEDGE_CHECK'
  | 'PAUSED_BY_TEACHER'
  | 'RECOVERY'
  | 'COMPLETED';

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  institutionId: string | null;
  institutionName: string | null;
  institutionType: InstitutionType | null;
  /** two-step login (TOTP) is active for this account */
  mfaEnabled: boolean;
  /** policy demands MFA for this role but it is not set up yet */
  mfaRequired: boolean;
}

export interface AnswerResult {
  answer: string;
  confidence: number;
  escalated: boolean;
  source: string;
  section?: number;
}

export interface Material {
  id: string;
  institutionId: string;
  title: string;
  subject: string | null;
  topic: string | null;
  level: string | null;
  language: string | null;
  type: string;
  visual: string | null;
  source: string | null;
  rights: string | null;
  status: 'pending' | 'approved' | 'rejected';
  fileName: string | null;
  fileMime: string | null;
  hasFile?: boolean;
}

export interface SessionReport {
  session: { id: string; status: string; startedAt: string; endedAt: string | null; teacherName: string | null; snapshot: LessonSnapshot | null };
  lesson: { id: string; title: string; sections: { title: string; done: boolean }[] };
  group: { id: string; name: string };
  attendance: { studentId: string; fullName: string; status: string; method?: string; changedBy?: string | null }[];
  questions: { id: string; text: string; answer: string; escalated: boolean; source: string | null; confidence: number | null }[];
  results: { id: string; question: string; answer: string; correct: boolean; quizIndex: number }[];
  score: number | null;
}
