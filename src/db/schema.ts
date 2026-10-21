// Relational model for spec §10. Every institution-owned table carries institution_id, and all
// queries for non-platform users are filtered by it (logical tenant isolation).
import { boolean, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { AvatarConfig, FaqItem, LessonSection, LessonSnapshot, QuizItem } from '@/lib/core/types';

const id = () => text('id').primaryKey();
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true });
const inst = () => text('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' });

export const institutions = pgTable('institutions', {
  id: id(),
  name: text('name').notNull(),
  type: text('type', { enum: ['kindergarten', 'school', 'university'] }).notNull(),
  city: text('city'),
  languages: jsonb('languages').$type<string[]>().notNull().default([]),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  avatar: jsonb('avatar').$type<AvatarConfig>(),
  createdAt: created(),
  updatedAt: updated(),
});

export const departments = pgTable('departments', {
  id: id(),
  institutionId: inst(),
  name: text('name').notNull(),
  createdAt: created(),
}, (t) => [index('departments_inst_idx').on(t.institutionId)]);

export const groups = pgTable('class_groups', {
  id: id(),
  institutionId: inst(),
  departmentId: text('department_id').references(() => departments.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  level: text('level'),
  room: text('room'),
  createdAt: created(),
}, (t) => [index('groups_inst_idx').on(t.institutionId)]);

export const students = pgTable('students', {
  id: id(),
  institutionId: inst(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: created(),
}, (t) => [index('students_group_idx').on(t.groupId), index('students_inst_idx').on(t.institutionId)]);

export const users = pgTable('users', {
  id: id(),
  institutionId: text('institution_id').references(() => institutions.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role', { enum: ['super_admin', 'inst_admin', 'director', 'teacher', 'student', 'technician'] }).notNull(),
  status: text('status', { enum: ['active', 'blocked'] }).notNull().default('active'),
  passwordHash: text('password_hash').notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex('users_username_uq').on(t.username), index('users_inst_idx').on(t.institutionId)]);

export const authSessions = pgTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  portal: text('portal').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: created(),
}, (t) => [index('auth_sessions_user_idx').on(t.userId)]);

export const loginAttempts = pgTable('login_attempts', {
  username: text('username').primaryKey(),
  failures: integer('failures').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});

export const subjects = pgTable('subjects', {
  id: id(),
  institutionId: inst(),
  name: text('name').notNull(),
  code: text('code'),
  createdAt: created(),
}, (t) => [index('subjects_inst_idx').on(t.institutionId)]);

export const materials = pgTable('materials', {
  id: id(),
  institutionId: inst(),
  title: text('title').notNull(),
  subject: text('subject'),
  topic: text('topic'),
  level: text('level'),
  language: text('language'),
  type: text('type').notNull().default('animation'),
  visual: text('visual'),
  source: text('source'),
  rights: text('rights'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  fileKey: text('file_key'),
  fileName: text('file_name'),
  fileMime: text('file_mime'),
  createdBy: text('created_by'),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('materials_inst_idx').on(t.institutionId)]);

export const lessons = pgTable('lessons', {
  id: id(),
  institutionId: inst(),
  subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  language: text('language').notNull().default('uz'),
  durationMin: integer('duration_min').notNull().default(30),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  greeting: text('greeting').notNull().default(''),
  sections: jsonb('sections').$type<LessonSection[]>().notNull().default([]),
  quiz: jsonb('quiz').$type<QuizItem[]>().notNull().default([]),
  faq: jsonb('faq').$type<FaqItem[]>().notNull().default([]),
  sampleQuestions: jsonb('sample_questions').$type<string[]>().notNull().default([]),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('lessons_inst_idx').on(t.institutionId)]);

export const lessonGroups = pgTable('lesson_groups', {
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.lessonId, t.groupId] })]);

export const schedule = pgTable('schedule', {
  id: id(),
  institutionId: inst(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  day: text('day'),
  time: text('time'),
  room: text('room'),
  createdAt: created(),
}, (t) => [index('schedule_inst_idx').on(t.institutionId)]);

export const devices = pgTable('classroom_devices', {
  id: id(),
  institutionId: inst(),
  room: text('room').notNull(),
  kind: text('kind', { enum: ['camera', 'microphone', 'speaker', 'panel', 'agent'] }).notNull(),
  model: text('model'),
  status: text('status', { enum: ['online', 'offline'] }).notNull().default('online'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [index('devices_inst_idx').on(t.institutionId)]);

export const lessonSessions = pgTable('lesson_sessions', {
  id: id(),
  institutionId: inst(),
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  teacherId: text('teacher_id').references(() => users.id, { onDelete: 'set null' }),
  teacherName: text('teacher_name'),
  status: text('status', { enum: ['active', 'completed'] }).notNull().default('active'),
  snapshot: jsonb('snapshot').$type<LessonSnapshot | null>(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  updatedAt: updated(),
}, (t) => [index('sessions_inst_idx').on(t.institutionId), index('sessions_group_idx').on(t.groupId, t.status)]);

export const attendance = pgTable('attendance_records', {
  id: id(),
  institutionId: inst(),
  sessionId: text('session_id').notNull().references(() => lessonSessions.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['present', 'absent', 'late', 'excused'] }).notNull(),
  method: text('method').notNull().default('manual'),
  changedBy: text('changed_by'),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('attendance_session_student_uq').on(t.sessionId, t.studentId)]);

export const questions = pgTable('questions', {
  id: id(),
  institutionId: inst(),
  sessionId: text('session_id').notNull().references(() => lessonSessions.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  answer: text('answer').notNull(),
  confidence: real('confidence'),
  source: text('source'),
  escalated: boolean('escalated').notNull().default(false),
  section: integer('section'),
  createdAt: created(),
}, (t) => [index('questions_session_idx').on(t.sessionId)]);

export const results = pgTable('assessment_results', {
  id: id(),
  institutionId: inst(),
  sessionId: text('session_id').notNull().references(() => lessonSessions.id, { onDelete: 'cascade' }),
  quizIndex: integer('quiz_index').notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  correct: boolean('correct').notNull(),
  checkType: text('check_type').notNull().default('class_quiz'),
  createdAt: created(),
}, (t) => [index('results_session_idx').on(t.sessionId)]);

export const auditLogs = pgTable('audit_logs', {
  id: id(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  userId: text('user_id'),
  username: text('username'),
  institutionId: text('institution_id'),
  action: text('action').notNull(),
  entity: text('entity'),
  entityId: text('entity_id'),
  details: text('details'),
}, (t) => [index('audit_inst_at_idx').on(t.institutionId, t.at)]);
