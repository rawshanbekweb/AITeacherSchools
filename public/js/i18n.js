// UI localisation (spec §12). Lesson content has its own language; this is the interface.
const D = {
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

let lang = 'uz';
try { lang = localStorage.getItem('ait-ui-lang') || 'uz'; } catch { /* ignore */ }

export const t = (key) => D[lang]?.[key] ?? D.uz[key] ?? key;
export const tState = (s) => D[lang]?.states?.[s] ?? D.uz.states[s] ?? s;
export const uiLang = () => lang;
export function setUiLang(l) {
  lang = D[l] ? l : 'uz';
  try { localStorage.setItem('ait-ui-lang', lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
}

// Phrases the teacher says, in the lesson's language.
export const PHRASES = {
  uz: {
    listening: 'Ha, eshitaman. Savolingizni bering.', resume: 'Yaxshi, darsni davom ettiramiz.', more: 'Yana savollar bormi?',
    nextSection: 'Keyingi mavzu:', quizIntro: 'Endi bilimlarimizni tekshirib ko‘ramiz. Tayyormisiz?', correct: 'Barakalla, to‘g‘ri!',
    wrong: 'Afsus, bu safar noto‘g‘ri.', bye: 'Bugungi darsimiz shu yerda yakunlandi. Faol ishtirokingiz uchun rahmat! Ko‘rishguncha!',
    attendance: 'Avval davomatni tekshirib olamiz.', paused: 'Dars pauza qilindi.', resumed: 'Davom etamiz.',
    thinking: 'Bir soniya, o‘ylab ko‘ray…', escalated: 'Savolingiz o‘qituvchiga yuborildi.', summaryScore: 'Test natijasi:', percent: 'foiz',
  },
  ru: {
    listening: 'Да, слушаю вас. Задайте вопрос.', resume: 'Хорошо, продолжаем занятие.', more: 'Есть ещё вопросы?',
    nextSection: 'Следующая тема:', quizIntro: 'Теперь проверим, как вы усвоили материал.', correct: 'Отлично, верно!',
    wrong: 'К сожалению, неверно.', bye: 'На этом наше занятие завершено. Спасибо за активную работу! До встречи!',
    attendance: 'Сначала отметим присутствующих.', paused: 'Урок поставлен на паузу.', resumed: 'Продолжаем.',
    thinking: 'Секунду, подумаю…', escalated: 'Вопрос передан преподавателю.', summaryScore: 'Результат теста:', percent: 'процентов',
  },
  en: {
    listening: 'Yes, I’m listening. Go ahead.', resume: 'Great, let’s continue the lesson.', more: 'Any more questions?',
    nextSection: 'Next topic:', quizIntro: 'Now let’s check what we have learned.', correct: 'Well done, that’s right!',
    wrong: 'Not quite this time.', bye: 'That’s all for today. Thank you for your great work! See you next time!',
    attendance: 'First, let’s take attendance.', paused: 'The lesson is paused.', resumed: 'Let’s continue.',
    thinking: 'One moment, let me think…', escalated: 'Your question was sent to the teacher.', summaryScore: 'Quiz score:', percent: 'percent',
  },
};
export const phrase = (lessonLang, key) => (PHRASES[lessonLang] || PHRASES.uz)[key];
