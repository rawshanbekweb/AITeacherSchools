// Demo data: three institution types sharing one platform (spec §4).
// All names are fictional. Passwords are hashed at startup, never stored in clear text.

export const DEMO_ACCOUNTS = [
  { username: 'superadmin', password: 'Admin#2026', role: 'super_admin', fullName: 'Platforma administratori', institutionId: null },
  { username: 'maktab.admin', password: 'Admin#2026', role: 'inst_admin', fullName: 'Dilnoza Karimova', institutionId: 'inst_school' },
  { username: 'teacher', password: 'Teacher#2026', role: 'teacher', fullName: 'Aziz Rahimov', institutionId: 'inst_school' },
  { username: 'director', password: 'Director#2026', role: 'director', fullName: 'Bahodir Usmonov', institutionId: 'inst_school' },
  { username: 'tech', password: 'Tech#2026', role: 'technician', fullName: 'Sardor Aliyev', institutionId: 'inst_school' },
  { username: 'bogcha', password: 'Teacher#2026', role: 'teacher', fullName: 'Malika Tursunova', institutionId: 'inst_kg' },
  { username: 'professor', password: 'Teacher#2026', role: 'teacher', fullName: 'Анвар Каримович', institutionId: 'inst_uni' },
];

const avatarDefault = {
  name: 'AI Ustoz',
  image: 'assets/teacher.webp',
  // Landmarks in image pixels (calibrated in Admin → Avatar studio).
  landmarks: {
    eyeL: [492, 334], eyeR: [674, 327], eyeW: 40, eyeH: 21,
    mouthL: [519, 537], mouthC: [596, 527], mouthR: [673, 521],
    chin: [600, 700], neck: [605, 790],
  },
  voiceGender: 'male',
  charisma: 0.7,
};

export function buildSeed() {
  const institutions = [
    { id: 'inst_school', name: '21-sonli umumta’lim maktabi', type: 'school', city: 'Toshkent', languages: ['uz', 'ru'], status: 'active', avatar: structuredClone(avatarDefault) },
    { id: 'inst_kg', name: '«Quyoshcha» bolalar bog‘chasi', type: 'kindergarten', city: 'Samarqand', languages: ['uz'], status: 'active', avatar: { ...structuredClone(avatarDefault), charisma: 1 } },
    { id: 'inst_uni', name: 'Raqamli texnologiyalar instituti', type: 'university', city: 'Toshkent', languages: ['ru', 'uz', 'en'], status: 'active', avatar: { ...structuredClone(avatarDefault), name: 'AI Professor', charisma: 0.5 } },
  ];

  const departments = [
    { id: 'dep_primary', institutionId: 'inst_school', name: 'Boshlang‘ich va o‘rta sinflar' },
    { id: 'dep_ai', institutionId: 'inst_uni', name: 'Sun’iy intellekt kafedrasi' },
  ];

  const groups = [
    { id: 'grp_5a', institutionId: 'inst_school', name: '5-A sinf', level: '5-sinf', room: '204-xona' },
    { id: 'grp_7b', institutionId: 'inst_school', name: '7-B sinf', level: '7-sinf', room: '311-xona' },
    { id: 'grp_lola', institutionId: 'inst_kg', name: '«Lola» katta guruhi', level: '5–6 yosh', room: 'O‘yin xonasi' },
    { id: 'grp_ai21', institutionId: 'inst_uni', name: 'AI-21', level: '3-kurs', room: 'Auditoriya 4.12' },
  ];

  const studentNames = {
    grp_5a: ['Abdulloh Nazarov', 'Madina Yusupova', 'Jasur Ergashev', 'Sevara Qodirova', 'Otabek Mirzayev', 'Nilufar Hamidova', 'Shohruh Toshmatov', 'Zarina Ismoilova', 'Behruz Salimov', 'Kamola Raximova', 'Sanjar Olimov', 'Dildora Xolmatova'],
    grp_7b: ['Akmal Sharipov', 'Gulnoza Aminova', 'Doniyor Qosimov', 'Feruza Nurmatova', 'Islom Jo‘rayev', 'Lobar Sodiqova'],
    grp_lola: ['Ali', 'Oysha', 'Umar', 'Laylo', 'Yusuf', 'Mohira', 'Ibrohim', 'Soliha'],
    grp_ai21: ['Тимур Ахмедов', 'Алина Ким', 'Jahongir Raupov', 'Elena Pak', 'Rustam Valiyev', 'Shahzoda Ortiqova'],
  };
  const students = [];
  for (const [groupId, names] of Object.entries(studentNames)) {
    const g = groups.find((x) => x.id === groupId);
    names.forEach((fullName, i) => students.push({ id: `stu_${groupId}_${i + 1}`, institutionId: g.institutionId, groupId, fullName, status: 'active' }));
  }

  const subjects = [
    { id: 'sub_nature', institutionId: 'inst_school', name: 'Tabiiy fanlar', code: 'NAT-5' },
    { id: 'sub_bio', institutionId: 'inst_school', name: 'Biologiya', code: 'BIO-7' },
    { id: 'sub_dev', institutionId: 'inst_kg', name: 'Rivojlantiruvchi mashg‘ulot', code: 'KG-1' },
    { id: 'sub_ml', institutionId: 'inst_uni', name: 'Машинное обучение', code: 'ML-301' },
  ];

  const mat = (id, institutionId, title, subject, topic, level, language, visual) => ({
    id, institutionId, title, subject, topic, level, language, type: 'animation', visual,
    source: 'AI Teacher kutubxonasi', rights: 'Ichki foydalanish', status: 'approved',
  });
  const materials = [
    mat('mat_sun', 'inst_school', 'Quyosh: yulduz tuzilishi', 'Tabiiy fanlar', 'Quyosh tizimi', '5-sinf', 'uz', 'sun'),
    mat('mat_solar', 'inst_school', 'Sayyoralar orbitasi animatsiyasi', 'Tabiiy fanlar', 'Quyosh tizimi', '5-sinf', 'uz', 'solar-system'),
    mat('mat_earth', 'inst_school', 'Yer va Oy: kun, tun, oy fazalari', 'Tabiiy fanlar', 'Quyosh tizimi', '5-sinf', 'uz', 'earth-moon'),
    mat('mat_leaf', 'inst_school', 'Barg tuzilishi va xlorofill', 'Biologiya', 'Fotosintez', '7-sinf', 'uz', 'leaf'),
    mat('mat_photo', 'inst_school', 'Fotosintez jarayoni sxemasi', 'Biologiya', 'Fotosintez', '7-sinf', 'uz', 'photosynthesis'),
    mat('mat_colors', 'inst_kg', 'Kamalak ranglari', 'Rivojlantiruvchi', 'Ranglar', '5–6 yosh', 'uz', 'colors'),
    mat('mat_count', 'inst_kg', 'Olmalarni sanaymiz', 'Rivojlantiruvchi', 'Sanash', '5–6 yosh', 'uz', 'counting'),
    mat('mat_neuron', 'inst_uni', 'Модель искусственного нейрона', 'ML', 'Нейронные сети', '3 курс', 'ru', 'neuron'),
    mat('mat_net', 'inst_uni', 'Прямое распространение в сети', 'ML', 'Нейронные сети', '3 курс', 'ru', 'neural-net'),
    mat('mat_grad', 'inst_uni', 'Градиентный спуск', 'ML', 'Обучение', '3 курс', 'ru', 'gradient'),
    { id: 'mat_draft', institutionId: 'inst_school', title: 'Vulqonlar (qoralama)', subject: 'Tabiiy fanlar', topic: 'Yer', level: '6-sinf', language: 'uz', type: 'pdf', visual: null, source: 'O‘qituvchi yuklagan', rights: 'Tekshirilmoqda', status: 'pending' },
  ];

  const lessons = [
    {
      id: 'les_solar', institutionId: 'inst_school', subjectId: 'sub_nature', groupIds: ['grp_5a'], language: 'uz',
      title: 'Quyosh tizimi', durationMin: 25, status: 'published',
      sampleQuestions: ['Pluton nega sayyora emas?', 'Mars nega qizil rangda?', 'Quyosh qachon o‘chadi?', 'Saturn halqalari nimadan iborat?', 'Futbolni kim ixtiro qilgan?'],
      greeting: 'Assalomu alaykum, aziz o‘quvchilar! Men sizning sun’iy intellekt ustozingizman. Bugun biz koinotga sayohat qilamiz — mavzuimiz: Quyosh tizimi.',
      sections: [
        {
          title: 'Quyosh — bizning yulduzimiz', materialId: 'mat_sun',
          sentences: [
            'Quyosh — bu ulkan, qaynoq gaz shari, ya’ni yulduz.',
            'U Yerdan taxminan yuz ellik million kilometr uzoqlikda joylashgan.',
            'Quyoshning ichiga bir million ikki yuz mingdan ortiq Yer sig‘ib ketadi!',
            'Uning yuzasidagi harorat taxminan olti ming daraja.',
            'Quyosh nuri Yergacha sakkiz daqiqada yetib keladi.',
          ],
        },
        {
          title: 'Sayyoralar tartibi', materialId: 'mat_solar',
          sentences: [
            'Quyosh atrofida sakkizta sayyora aylanadi.',
            'Ular tartib bilan: Merkuriy, Venera, Yer, Mars, Yupiter, Saturn, Uran va Neptun.',
            'Birinchi to‘rttasi — tosh sayyoralar, qolgan to‘rttasi esa ulkan gaz sayyoralar.',
            'Eng katta sayyora — Yupiter, uning ichiga Yerdek mingdan ortiq sayyora sig‘adi.',
            'Saturn o‘zining chiroyli halqalari bilan mashhur.',
          ],
        },
        {
          title: 'Yer va Oy', materialId: 'mat_earth',
          sentences: [
            'Yer o‘z o‘qi atrofida yigirma to‘rt soatda bir marta aylanadi — shuning uchun kun va tun almashadi.',
            'Quyosh atrofida esa bir yilda, ya’ni uch yuz oltmish besh kunda bir marta aylanib chiqadi.',
            'Oy — Yerning tabiiy yo‘ldoshi.',
            'U o‘zidan nur chiqarmaydi, balki Quyosh nurini qaytaradi.',
          ],
        },
      ],
      quiz: [
        { q: 'Quyoshga eng yaqin sayyora qaysi?', options: ['Venera', 'Merkuriy', 'Mars', 'Yer'], answer: 1, explain: 'To‘g‘ri javob — Merkuriy. U Quyoshga eng yaqin sayyora.' },
        { q: 'Quyosh tizimidagi eng katta sayyora qaysi?', options: ['Saturn', 'Yer', 'Yupiter', 'Neptun'], answer: 2, explain: 'Eng katta sayyora — Yupiter.' },
        { q: 'Nima uchun kun va tun almashadi?', options: ['Oy Quyoshni to‘sadi', 'Yer o‘z o‘qi atrofida aylanadi', 'Quyosh o‘chib-yonadi', 'Bulutlar sababli'], answer: 1, explain: 'Yer o‘z o‘qi atrofida aylangani uchun kun va tun almashadi.' },
      ],
      faq: [
        { keys: ['pluton', 'plutonchi', 'sayyora emas'], a: 'Yaxshi savol! Pluton ilgari to‘qqizinchi sayyora deb hisoblangan. Ammo 2006-yilda olimlar uni «mitti sayyora» deb atashga qaror qilishdi, chunki u juda kichik va orbitasini boshqa jismlardan tozalay olmaydi.' },
        { keys: ['quyosh', 'o‘chadi', 'o‘chib', 'tugaydi', 'qachon'], a: 'Quyosh yana taxminan besh milliard yil nur sochadi. Shuning uchun xavotirga o‘rin yo‘q!' },
        { keys: ['oy', 'nega', 'shakli', 'o‘zgaradi', 'fazalar', 'yarim'], a: 'Oy shakli o‘zgarmaydi, u doim shar. Biz Oyning Quyosh yoritgan qismini turli burchakdan ko‘ramiz — buni Oy fazalari deyiladi. To‘lin oydan yangi oygacha taxminan yigirma to‘qqiz kun o‘tadi.' },
        { keys: ['mars', 'qizil', 'nega qizil'], a: 'Mars qizil ko‘rinadi, chunki uning tuprog‘ida temir oksidi, ya’ni zang ko‘p. Shuning uchun uni «Qizil sayyora» deyishadi.' },
        { keys: ['saturn', 'halqa', 'halqalari', 'nimadan'], a: 'Saturn halqalari muz va tosh bo‘laklaridan iborat. Ba’zi bo‘laklar qum donasidek, ba’zilari esa uydek katta!' },
        { keys: ['yupiter', 'katta', 'qanchalik'], a: 'Yupiter shunchalik kattaki, uning ichiga mingdan ortiq Yer sig‘adi. U asosan vodorod va geliy gazidan iborat.' },
        { keys: ['yer', 'shar', 'dumaloq', 'aylanadi', 'sezmaymiz'], a: 'Yer juda tez aylanadi, lekin biz buni sezmaymiz, chunki biz ham, havo ham Yer bilan birga bir tekis harakatlanamiz.' },
      ],
    },
    {
      id: 'les_photo', institutionId: 'inst_school', subjectId: 'sub_bio', groupIds: ['grp_7b'], language: 'uz',
      title: 'Fotosintez', durationMin: 30, status: 'published',
      sampleQuestions: ['Kechasi fotosintez bo‘ladimi?', 'Kuzda barglar nega sariq bo‘ladi?', 'Xlorofill nima?'],
      greeting: 'Assalomu alaykum! Bugun o‘simliklar qanday qilib quyosh nuridan oziq tayyorlashini bilib olamiz. Mavzu: fotosintez.',
      sections: [
        {
          title: 'Barg — o‘simlik oshxonasi', materialId: 'mat_leaf',
          sentences: [
            'O‘simlik bargida xloroplast deb ataladigan juda kichik yashil donachalar bor.',
            'Ularning ichidagi xlorofill moddasi bargga yashil rang beradi.',
            'Xlorofill quyosh nurini tutib oladi — xuddi quyosh paneli kabi.',
          ],
        },
        {
          title: 'Fotosintez jarayoni', materialId: 'mat_photo',
          sentences: [
            'O‘simlik ildizi orqali suv, barg teshikchalari orqali esa karbonat angidrid gazini oladi.',
            'Quyosh nuri energiyasi yordamida ulardan glyukoza, ya’ni shakar hosil bo‘ladi.',
            'Bu jarayonda havoga kislorod ajralib chiqadi — biz aynan shu kislorod bilan nafas olamiz.',
            'Demak, o‘simliklar sayyoramizning tabiiy kislorod zavodi!',
          ],
        },
      ],
      quiz: [
        { q: 'Fotosintez natijasida havoga qaysi gaz ajraladi?', options: ['Azot', 'Kislorod', 'Karbonat angidrid', 'Vodorod'], answer: 1, explain: 'Fotosintezda kislorod ajralib chiqadi.' },
        { q: 'Bargga yashil rang beradigan modda?', options: ['Glyukoza', 'Kraxmal', 'Xlorofill', 'Suv'], answer: 2, explain: 'Bargni xlorofill yashil qiladi.' },
      ],
      faq: [
        { keys: ['kech', 'tun', 'kechasi', 'qorong‘i'], a: 'Kechasi quyosh nuri bo‘lmagani uchun fotosintez to‘xtaydi, lekin o‘simlik nafas olishda davom etadi.' },
        { keys: ['kuz', 'sariq', 'barglar', 'rang'], a: 'Kuzda xlorofill parchalanadi va bargdagi sariq hamda qizil pigmentlar ko‘rinib qoladi.' },
      ],
    },
    {
      id: 'les_colors', institutionId: 'inst_kg', subjectId: 'sub_dev', groupIds: ['grp_lola'], language: 'uz',
      title: 'Ranglar va sanash', durationMin: 15, status: 'published',
      sampleQuestions: ['Kamalak qachon chiqadi?', 'Osmon nega ko‘k?'],
      greeting: 'Salom, jajji do‘stlarim! Men sizlarni juda sog‘indim! Keling, birga o‘ynaymiz!',
      sections: [
        {
          title: 'Kamalak ranglari', materialId: 'mat_colors',
          sentences: [
            'Qarang, bu — kamalak!',
            'Qizil — xuddi olma kabi.',
            'Sariq — xuddi quyosh kabi.',
            'Yashil — xuddi o‘t-o‘lan kabi.',
            'Ko‘k — xuddi osmon kabi. Barakalla!',
          ],
        },
        {
          title: 'Olmalarni sanaymiz', materialId: 'mat_count',
          sentences: [
            'Endi olmalarni birga sanaymiz.',
            'Bir, ikki, uch, to‘rt, besh!',
            'Savatda beshta olma bor. Ofarin, bolajonlar!',
          ],
        },
      ],
      quiz: [
        { q: 'Osmon qanday rangda?', options: ['Qizil', 'Ko‘k', 'Sariq'], answer: 1, explain: 'Ha, osmon ko‘k rangda! Barakalla!' },
        { q: 'Savatda nechta olma bor edi?', options: ['3', '5', '7'], answer: 1, explain: 'To‘g‘ri, beshta olma! Ofarin!' },
      ],
      faq: [
        { keys: ['kamalak', 'qachon', 'chiqadi'], a: 'Kamalak yomg‘irdan keyin quyosh chiqqanda paydo bo‘ladi!' },
      ],
    },
    {
      id: 'les_nn', institutionId: 'inst_uni', subjectId: 'sub_ml', groupIds: ['grp_ai21'], language: 'ru',
      title: 'Нейронные сети: основы', durationMin: 40, status: 'published',
      sampleQuestions: ['Что такое переобучение?', 'Почему ReLU лучше сигмоиды?', 'Какую скорость обучения выбрать?'],
      greeting: 'Здравствуйте, коллеги! Сегодня разберём, как устроена искусственная нейронная сеть и как она обучается.',
      sections: [
        {
          title: 'Искусственный нейрон', materialId: 'mat_neuron',
          sentences: [
            'Искусственный нейрон получает несколько входных значений.',
            'Каждый вход умножается на свой вес, затем результаты суммируются вместе со смещением.',
            'К сумме применяется функция активации, например ReLU или сигмоида.',
            'Именно нелинейная активация позволяет сети описывать сложные зависимости.',
          ],
        },
        {
          title: 'Слои и прямое распространение', materialId: 'mat_net',
          sentences: [
            'Нейроны объединяются в слои: входной, скрытые и выходной.',
            'Сигнал проходит от входа к выходу — это называется прямым распространением.',
            'Выход сети сравнивается с правильным ответом с помощью функции потерь.',
          ],
        },
        {
          title: 'Обучение: градиентный спуск', materialId: 'mat_grad',
          sentences: [
            'Чтобы уменьшить ошибку, мы вычисляем градиент функции потерь по каждому весу.',
            'Алгоритм обратного распространения эффективно считает эти градиенты.',
            'Затем веса сдвигаются в сторону, противоположную градиенту, с шагом, который называется скоростью обучения.',
          ],
        },
      ],
      quiz: [
        { q: 'Зачем нужна функция активации?', options: ['Ускорить вычисления', 'Добавить нелинейность', 'Хранить данные', 'Уменьшить число весов'], answer: 1, explain: 'Функция активации добавляет нелинейность.' },
        { q: 'Что вычисляет обратное распространение?', options: ['Градиенты по весам', 'Входные данные', 'Число слоёв', 'Точность модели'], answer: 0, explain: 'Обратное распространение вычисляет градиенты функции потерь по весам.' },
      ],
      faq: [
        { keys: ['переобучение', 'overfitting', 'переобуч'], a: 'Переобучение — когда модель запоминает обучающие данные и плохо работает на новых. Помогают регуляризация, dropout, больше данных и ранняя остановка.' },
        { keys: ['скорость', 'обучения', 'learning', 'rate', 'большая', 'маленькая'], a: 'Слишком большая скорость обучения приводит к расхождению, слишком маленькая — к очень медленной сходимости. Часто используют расписание или адаптивные оптимизаторы, например Adam.' },
        { keys: ['relu', 'сигмоида', 'почему', 'лучше'], a: 'ReLU проще вычислять и она меньше страдает от затухания градиента, чем сигмоида, поэтому её чаще используют в скрытых слоях.' },
      ],
    },
  ];

  const devices = [
    { id: 'dev_cam_204', institutionId: 'inst_school', room: '204-xona', kind: 'camera', model: 'USB Full HD kamera', status: 'online' },
    { id: 'dev_mic_204', institutionId: 'inst_school', room: '204-xona', kind: 'microphone', model: 'USB mikrofon massivi', status: 'online' },
    { id: 'dev_spk_204', institutionId: 'inst_school', room: '204-xona', kind: 'speaker', model: 'Faol akustika 2×20W', status: 'online' },
    { id: 'dev_pnl_204', institutionId: 'inst_school', room: '204-xona', kind: 'panel', model: 'Interaktiv panel 86"', status: 'online' },
    { id: 'dev_cam_311', institutionId: 'inst_school', room: '311-xona', kind: 'camera', model: 'IP kamera', status: 'offline' },
    { id: 'dev_pnl_kg', institutionId: 'inst_kg', room: 'O‘yin xonasi', kind: 'panel', model: 'Interaktiv panel 75"', status: 'online' },
    { id: 'dev_pnl_uni', institutionId: 'inst_uni', room: 'Auditoriya 4.12', kind: 'panel', model: 'Проектор + доска', status: 'online' },
  ];

  const schedule = [
    { id: 'sch_1', institutionId: 'inst_school', groupId: 'grp_5a', lessonId: 'les_solar', day: 'Dushanba', time: '09:00', room: '204-xona' },
    { id: 'sch_2', institutionId: 'inst_school', groupId: 'grp_7b', lessonId: 'les_photo', day: 'Seshanba', time: '10:00', room: '311-xona' },
    { id: 'sch_3', institutionId: 'inst_kg', groupId: 'grp_lola', lessonId: 'les_colors', day: 'Har kuni', time: '10:30', room: 'O‘yin xonasi' },
    { id: 'sch_4', institutionId: 'inst_uni', groupId: 'grp_ai21', lessonId: 'les_nn', day: 'Среда', time: '13:30', room: 'Auditoriya 4.12' },
  ];

  return {
    institutions, departments, groups, students, subjects, materials, lessons, devices, schedule,
    users: [], sessions: [], attendance: [], questions: [], results: [], audit: [],
  };
}
