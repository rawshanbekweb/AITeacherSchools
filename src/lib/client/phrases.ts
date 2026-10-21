// What the teacher says, in the lesson's language.
export const PHRASES = {
  uz: {
    listening: 'Ha, eshitaman. Savolingizni bering.', resume: 'Yaxshi, darsni davom ettiramiz.', more: 'Yana savollar bormi?',
    nextSection: 'Keyingi mavzu:', quizIntro: 'Endi bilimlarimizni tekshirib ko‘ramiz. Tayyormisiz?', correct: 'Barakalla, to‘g‘ri!',
    wrong: 'Afsus, bu safar noto‘g‘ri.', bye: 'Bugungi darsimiz shu yerda yakunlandi. Faol ishtirokingiz uchun rahmat! Ko‘rishguncha!',
    attendance: 'Avval davomatni tekshirib olamiz.', paused: 'Dars pauza qilindi.', resumed: 'Davom etamiz.',
    thinking: 'Bir soniya, o‘ylab ko‘ray…', answerError: 'Javob olishda xatolik yuz berdi. Savolni o‘qituvchiga yo‘naltiraman.', escalated: 'Savolingiz o‘qituvchiga yuborildi.', summaryScore: 'Test natijasi:', percent: 'foiz',
  },
  ru: {
    listening: 'Да, слушаю вас. Задайте вопрос.', resume: 'Хорошо, продолжаем занятие.', more: 'Есть ещё вопросы?',
    nextSection: 'Следующая тема:', quizIntro: 'Теперь проверим, как вы усвоили материал.', correct: 'Отлично, верно!',
    wrong: 'К сожалению, неверно.', bye: 'На этом наше занятие завершено. Спасибо за активную работу! До встречи!',
    attendance: 'Сначала отметим присутствующих.', paused: 'Урок поставлен на паузу.', resumed: 'Продолжаем.',
    thinking: 'Секунду, подумаю…', answerError: 'Не удалось получить ответ. Я передам вопрос преподавателю.', escalated: 'Вопрос передан преподавателю.', summaryScore: 'Результат теста:', percent: 'процентов',
  },
  en: {
    listening: 'Yes, I’m listening. Go ahead.', resume: 'Great, let’s continue the lesson.', more: 'Any more questions?',
    nextSection: 'Next topic:', quizIntro: 'Now let’s check what we have learned.', correct: 'Well done, that’s right!',
    wrong: 'Not quite this time.', bye: 'That’s all for today. Thank you for your great work! See you next time!',
    attendance: 'First, let’s take attendance.', paused: 'The lesson is paused.', resumed: 'Let’s continue.',
    thinking: 'One moment, let me think…', answerError: 'I could not get an answer. I will pass the question to your teacher.', escalated: 'Your question was sent to the teacher.', summaryScore: 'Quiz score:', percent: 'percent',
  },
};
export type PhraseKey = keyof (typeof PHRASES)['uz'];
export const phrase = (lessonLang: string, key: PhraseKey): string => (PHRASES[lessonLang as keyof typeof PHRASES] ?? PHRASES.uz)[key];
