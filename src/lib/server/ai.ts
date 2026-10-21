import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { AnswerResult, Lesson } from '@/lib/core/types';

// Claude-backed answer provider, enabled when ANTHROPIC_API_KEY is set; otherwise the platform
// answers offline from approved lesson material. Only lesson content and the question text are
// sent — no student names or other personal data (spec §13).

const AGE: Record<string, string> = {
  kindergarten: 'Learners are 4–6 year old children: use one or two very short, warm, simple sentences.',
  school: 'Learners are school pupils: explain clearly with a simple example, 2–4 sentences.',
  university: 'Learners are university students: precise terminology is fine, 3–6 sentences.',
};
const LANG: Record<string, string> = { uz: 'Uzbek (Latin script)', ru: 'Russian', en: 'English' };

const SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'The spoken answer, plain text without markdown.' },
    on_topic: { type: 'boolean', description: 'True when the approved lesson material supports the answer.' },
    related_section: { type: 'integer', description: 'Index of the most relevant lesson section, or -1.' },
  },
  required: ['answer', 'on_topic', 'related_section'],
  additionalProperties: false,
};

export type AnswerProvider = (input: { lesson: Lesson; institutionType: string; question: string; sectionIndex: number; history: { q: string; a: string }[] }) => Promise<AnswerResult | null>;

let cached: AnswerProvider | null | undefined;

export function getAnswerProvider(): AnswerProvider | null {
  if (cached !== undefined) return cached;
  if (!process.env.ANTHROPIC_API_KEY) return (cached = null);
  const client = new Anthropic();
  const model = process.env.AI_TEACHER_MODEL || 'claude-opus-5-5';

  cached = async ({ lesson, institutionType, question, sectionIndex, history }) => {
    const material = lesson.sections.map((s, i) => `Section ${i}: ${s.title}\n${s.sentences.join(' ')}`).join('\n\n');
    const faq = (lesson.faq || []).map((f) => `- ${f.a}`).join('\n');
    const system = [
      'You are "AI Teacher", a friendly virtual teacher speaking out loud to a class through a smart-classroom panel.',
      `Answer in ${LANG[lesson.language] || 'Uzbek'}. ${AGE[institutionType] || AGE.school}`,
      'Your answer is converted to speech: no markdown, no lists, no emoji, spell out numbers when natural.',
      'Base the answer on the approved lesson material below. General, uncontroversial background knowledge that fits the topic and age is fine.',
      'If the question is unrelated to the lesson, unsafe, personal, or you are not confident, set on_topic to false and say kindly that you will pass the question to the human teacher.',
      `\nLesson: ${lesson.title}\n\n${material}\n\nApproved extra notes:\n${faq || '(none)'}`,
    ].join('\n');

    const messages: Anthropic.Beta.BetaMessageParam[] = [];
    for (const h of history.slice(-4)) messages.push({ role: 'user', content: h.q }, { role: 'assistant', content: h.a });
    messages.push({ role: 'user', content: `The class is currently on section ${sectionIndex}. Student question: ${question}` });

    const response = await client.beta.messages.create(
      {
        model,
        max_tokens: 2000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        system,
        messages,
      },
      { timeout: 20_000 },
    );
    if (response.stop_reason === 'refusal') return null;
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const parsed = JSON.parse(text) as { answer: string; on_topic: boolean; related_section: number };
    return {
      answer: parsed.answer,
      confidence: parsed.on_topic ? 0.9 : 0.2,
      escalated: !parsed.on_topic,
      section: parsed.related_section >= 0 && parsed.related_section < lesson.sections.length ? parsed.related_section : undefined,
      source: 'claude',
    };
  };
  return cached;
}
