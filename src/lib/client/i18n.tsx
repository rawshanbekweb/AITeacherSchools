'use client';
// UI localisation (spec §12). Lesson content has its own language; this is the interface.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UiLang = 'uz' | 'ru' | 'en';

type Dict = { [key: string]: string | Record<string, string>; states: Record<string, string> };
const D: Record<UiLang, Dict> = {
  uz: {
    login: 'Kirish', username: 'Login', password: 'Parol', logout: 'Chiqish',
    classroomTitle: 'AI Teacher Classroom', adminTitle: 'AI Teacher Admin',
    chooseLesson: 'Darsni tanlang', institution: 'Muassasa', group: 'Sinf / guruh', lesson: 'Dars',
    deviceCheck: 'Qurilmalar tekshiruvi', camera: 'Kamera', mic: 'Mikrofon', speaker: 'Karnay', network: 'Tarmoq', ai: 'AI xizmati',
    startLesson: 'Darsni boshlash', resumeLesson: 'Darsni davom ettirish', testVoice: 'Ovozni sinash',
    pause: 'Pauza', resume: 'Davom etish', ask: 'Savol berish', next: 'Keyingi bo‘lim', stopVoice: 'Ovozni to‘xtatish',
    end: 'Darsni yakunlash', repeat: 'Takrorlash', muteMic: 'Mikrofonni o‘chirish', unmuteMic: 'Mikrofonni yoqish',
    attendance: 'Davomat', confirmAttendance: 'Tasdiqlash va darsni boshlash', present: 'Bor', absent: 'Yo‘q', late: 'Kechikdi', excused: 'Sababli',
    allPresent: 'Hammasi bor', questionPrompt: 'Savolingizni ayting yoki yozing', send: 'Yuborish', cancel: 'Bekor qilish',
    moreQuestions: 'Yana savollar bormi?', yes: 'Ha, savolim bor', no: 'Yo‘q, davom etamiz',
    quiz: 'Bilimni tekshirish', summary: 'Dars yakuni', report: 'Hisobot', newLesson: 'Yangi dars',
    paused: 'Dars pauzada', recovery: 'Aloqa tiklanmoqda…', recoveryHint: 'Dars holati saqlangan. Aloqa tiklangach shu joydan davom etamiz.',
    subtitles: 'Subtitrlar', volume: 'Ovoz balandligi', textSize: 'Matn o‘lchami', voice: 'Ovoz', wakeWord: 'Ovoz bilan chaqirish («Ustoz»)',
    states: {
      READY: 'Tayyor', CHECKING_ATTENDANCE: 'Davomat', TEACHING: 'Dars o‘tilmoqda', LISTENING_FOR_QUESTION: 'Savol tinglanmoqda',
      ANSWERING: 'Javob berilmoqda', CHECKING_FOLLOW_UP: 'Qo‘shimcha savollar', KNOWLEDGE_CHECK: 'Bilim tekshiruvi',
      PAUSED_BY_TEACHER: 'Pauza', RECOVERY: 'Tiklanmoqda', COMPLETED: 'Yakunlandi',
    },
  },
  ru: {
    login: 'Войти', username: 'Логин', password: 'Пароль', logout: 'Выйти',
    chooseLesson: 'Выберите урок', institution: 'Учреждение', group: 'Класс / группа', lesson: 'Урок',
    deviceCheck: 'Проверка оборудования', camera: 'Камера', mic: 'Микрофон', speaker: 'Колонка', network: 'Сеть', ai: 'AI-сервис',
    startLesson: 'Начать урок', resumeLesson: 'Продолжить урок', testVoice: 'Проверить голос',
    pause: 'Пауза', resume: 'Продолжить', ask: 'Задать вопрос', next: 'Следующий раздел', stopVoice: 'Остановить озвучку',
    end: 'Завершить урок', repeat: 'Повторить', muteMic: 'Выключить микрофон', unmuteMic: 'Включить микрофон',
    attendance: 'Посещаемость', confirmAttendance: 'Подтвердить и начать', present: 'Есть', absent: 'Нет', late: 'Опоздал', excused: 'Уваж.',
    allPresent: 'Все присутствуют', questionPrompt: 'Задайте вопрос голосом или текстом', send: 'Отправить', cancel: 'Отмена',
    moreQuestions: 'Есть ещё вопросы?', yes: 'Да, есть вопрос', no: 'Нет, продолжаем',
    quiz: 'Проверка знаний', summary: 'Итог занятия', report: 'Отчёт', newLesson: 'Новый урок',
    paused: 'Урок на паузе', recovery: 'Восстановление связи…', recoveryHint: 'Состояние урока сохранено. Продолжим с того же места.',
    subtitles: 'Субтитры', volume: 'Громкость', textSize: 'Размер текста', voice: 'Голос', wakeWord: 'Голосовой вызов («Учитель»)',
    states: {
      READY: 'Готов', CHECKING_ATTENDANCE: 'Посещаемость', TEACHING: 'Объяснение', LISTENING_FOR_QUESTION: 'Слушаю вопрос',
      ANSWERING: 'Ответ', CHECKING_FOLLOW_UP: 'Доп. вопросы', KNOWLEDGE_CHECK: 'Проверка знаний',
      PAUSED_BY_TEACHER: 'Пауза', RECOVERY: 'Восстановление', COMPLETED: 'Завершён',
    },
  },
  en: {
    login: 'Sign in', username: 'Username', password: 'Password', logout: 'Sign out',
    chooseLesson: 'Choose a lesson', institution: 'Institution', group: 'Class / group', lesson: 'Lesson',
    deviceCheck: 'Device check', camera: 'Camera', mic: 'Microphone', speaker: 'Speaker', network: 'Network', ai: 'AI service',
    startLesson: 'Start lesson', resumeLesson: 'Resume lesson', testVoice: 'Test voice',
    pause: 'Pause', resume: 'Resume', ask: 'Ask a question', next: 'Next section', stopVoice: 'Stop voice',
    end: 'End lesson', repeat: 'Repeat', muteMic: 'Mute mic', unmuteMic: 'Unmute mic',
    attendance: 'Attendance', confirmAttendance: 'Confirm and start', present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused',
    allPresent: 'All present', questionPrompt: 'Say or type your question', send: 'Send', cancel: 'Cancel',
    moreQuestions: 'Any more questions?', yes: 'Yes, I have one', no: 'No, let’s continue',
    quiz: 'Knowledge check', summary: 'Lesson summary', report: 'Report', newLesson: 'New lesson',
    paused: 'Lesson paused', recovery: 'Reconnecting…', recoveryHint: 'Lesson state is saved. We will continue from the same place.',
    subtitles: 'Subtitles', volume: 'Volume', textSize: 'Text size', voice: 'Voice', wakeWord: 'Voice wake word («Teacher»)',
    states: {
      READY: 'Ready', CHECKING_ATTENDANCE: 'Attendance', TEACHING: 'Teaching', LISTENING_FOR_QUESTION: 'Listening',
      ANSWERING: 'Answering', CHECKING_FOLLOW_UP: 'Follow-up', KNOWLEDGE_CHECK: 'Knowledge check',
      PAUSED_BY_TEACHER: 'Paused', RECOVERY: 'Recovery', COMPLETED: 'Completed',
    },
  },
};


export function translate(lang: UiLang, key: string): string {
  const v = D[lang]?.[key] ?? D.uz[key];
  return typeof v === 'string' ? v : key;
}
export function translateState(lang: UiLang, s: string): string {
  return D[lang]?.states?.[s] ?? D.uz.states[s] ?? s;
}

const Ctx = createContext<{ lang: UiLang; setLang: (l: UiLang) => void }>({ lang: 'uz', setLang: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UiLang>('uz');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ait-ui-lang') as UiLang | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the saved preference after mount
      if (saved && saved in D) setLangState(saved);
    } catch { /* storage unavailable */ }
  }, []);
  const setLang = useCallback((l: UiLang) => {
    setLangState(l);
    try { localStorage.setItem('ait-ui-lang', l); } catch { /* ignore */ }
    document.documentElement.lang = l;
  }, []);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const { lang, setLang } = useContext(Ctx);
  const t = useCallback((k: string) => translate(lang, k), [lang]);
  const tState = useCallback((s: string) => translateState(lang, s), [lang]);
  return { lang, setLang, t, tState };
}
