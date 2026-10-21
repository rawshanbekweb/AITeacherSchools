// Offline answer engine: answers only from the lesson's approved material (spec §5.6).
// Used when no LLM provider is configured, and as a fallback when the provider fails.

import type { AnswerResult, Lesson } from './types';

const STOP = new Set([
  // uz
  'va', 'bu', 'u', 'nima', 'nimaga', 'nega', 'qanday', 'qanaqa', 'qaysi', 'qachon', 'qayerda', 'necha', 'nechta', 'mi', 'edi', 'bilan', 'uchun', 'ham', 'da', 'ga', 'ni', 'ning', 'men', 'biz', 'siz', 'ustoz', 'iltimos', 'aytib', 'bering', 'bor', 'yo‘q', 'emas', 'qilib', 'nimadan', 'nimalar',
  // ru
  'и', 'в', 'на', 'что', 'как', 'почему', 'зачем', 'это', 'а', 'ли', 'не', 'с', 'по', 'для', 'то', 'же', 'такое', 'можно', 'ли', 'ещё', 'еще', 'учитель', 'скажите', 'пожалуйста',
  // en
  'the', 'a', 'an', 'is', 'are', 'what', 'why', 'how', 'when', 'of', 'to', 'in', 'do', 'does', 'teacher', 'please',
]);

export function tokens(text: string): string[] {
  return String(text)
    .toLowerCase()
    .replace(/[ʻʼ’`']/g, '‘')
    .replace(/[^\p{L}\p{N}‘\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => w.slice(0, 5)); // crude stem: works well enough for agglutinative uz and inflected ru
}

const MSG: Record<string, { unsure: string; fromLesson: string }> = {
  uz: {
    unsure: 'Bu juda qiziq savol, lekin u bugungi dars materiallaridan tashqarida. Noto‘g‘ri ma’lumot bermaslik uchun savolingizni o‘qituvchiga yo‘naltiraman.',
    fromLesson: 'Darsimizda aytilganidek:',
  },
  ru: {
    unsure: 'Интересный вопрос, но он выходит за рамки сегодняшних материалов. Чтобы не дать неточный ответ, я передам его преподавателю.',
    fromLesson: 'Как мы уже говорили на занятии:',
  },
  en: {
    unsure: 'That is an interesting question, but it is outside today’s approved material. I will pass it to your teacher so you get an accurate answer.',
    fromLesson: 'As we covered in the lesson:',
  },
};

export function offlineAnswer(lesson: Pick<Lesson, 'language' | 'faq' | 'sections'>, question: string, sectionIndex = 0): AnswerResult {
  const lang = MSG[lesson.language] ? lesson.language : 'uz';
  const q = new Set(tokens(question));
  if (!q.size) return { answer: MSG[lang].unsure, confidence: 0, escalated: true, source: 'offline' };

  let best: { score: number; answer?: string; section?: number } = { score: 0 };
  for (const f of lesson.faq || []) {
    const keys = new Set(f.keys.flatMap(tokens));
    let score = 0;
    for (const t of q) if (keys.has(t)) score += 1.4;
    if (score > best.score) best = { score, answer: f.a };
  }
  lesson.sections.forEach((sec, si) => {
    sec.sentences.forEach((sent, i) => {
      const st = new Set(tokens(sent + ' ' + sec.title));
      let score = 0;
      for (const t of q) if (st.has(t)) score += 1;
      if (si === sectionIndex) score *= 1.15; // prefer the section being taught
      if (score > best.score) {
        const next = sec.sentences[i + 1];
        best = { score, answer: `${MSG[lang].fromLesson} ${sent}${next ? ' ' + next : ''}`, section: si };
      }
    });
  });

  const confidence = Math.min(1, best.score / Math.max(2, q.size));
  if (best.score < 1.4 || confidence < 0.3) {
    return { answer: MSG[lang].unsure, confidence, escalated: true, source: 'offline' };
  }
  return { answer: best.answer ?? MSG[lang].unsure, confidence, escalated: false, source: 'offline', section: best.section };
}
