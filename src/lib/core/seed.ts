// Demo data: three institution types sharing one platform (spec §4).
// All names are fictional. Passwords are hashed when seeding, never stored in clear text.
import type { Role } from './types';
import { DEFAULT_AVATAR as avatarDefault } from './avatar-default';

export const DEMO_ACCOUNTS: { username: string; password: string; role: Role; fullName: string; institutionId: string | null }[] = [
  { username: 'superadmin', password: 'Admin#2026', role: 'super_admin', fullName: 'Platforma administratori', institutionId: null },
  { username: 'maktab.admin', password: 'Admin#2026', role: 'inst_admin', fullName: 'Dilnoza Karimova', institutionId: 'inst_school' },
  { username: 'teacher', password: 'Teacher#2026', role: 'teacher', fullName: 'Aziz Rahimov', institutionId: 'inst_school' },
  { username: 'director', password: 'Director#2026', role: 'director', fullName: 'Bahodir Usmonov', institutionId: 'inst_school' },
  { username: 'tech', password: 'Tech#2026', role: 'technician', fullName: 'Sardor Aliyev', institutionId: 'inst_school' },
  { username: 'bogcha', password: 'Teacher#2026', role: 'teacher', fullName: 'Malika Tursunova', institutionId: 'inst_kg' },
  { username: 'professor', password: 'Teacher#2026', role: 'teacher', fullName: 'Анвар Каримович', institutionId: 'inst_uni' },
];



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
  const students: { id: string; institutionId: string; groupId: string; fullName: string; status: 'active' }[] = [];
  for (const [groupId, names] of Object.entries(studentNames)) {
    const g = groups.find((x) => x.id === groupId)!;
    names.forEach((fullName, i) => students.push({ id: `stu_${groupId}_${i + 1}`, institutionId: g.institutionId, groupId, fullName, status: 'active' }));
  }

  const subjects = [
    { id: 'sub_nature', institutionId: 'inst_school', name: 'Tabiiy fanlar', code: 'NAT-5' },
    { id: 'sub_bio', institutionId: 'inst_school', name: 'Biologiya', code: 'BIO-7' },
    { id: 'sub_math', institutionId: 'inst_school', name: 'Matematika', code: 'MATH-5' },
    { id: 'sub_dev', institutionId: 'inst_kg', name: 'Rivojlantiruvchi mashg‘ulot', code: 'KG-1' },
    { id: 'sub_ml', institutionId: 'inst_uni', name: 'Машинное обучение', code: 'ML-301' },
  ];

  const mat = (id: string, institutionId: string, title: string, subject: string, topic: string, level: string, language: string, visual: string) => ({
    id, institutionId, title, subject, topic, level, language, type: 'animation', visual,
    source: 'AI Teacher kutubxonasi', rights: 'Ichki foydalanish', status: 'approved' as const,
  });
  const materials = [
    mat('mat_sun', 'inst_school', 'Quyosh: yulduz tuzilishi', 'Tabiiy fanlar', 'Quyosh tizimi', '5-sinf', 'uz', 'sun'),
    mat('mat_solar', 'inst_school', 'Sayyoralar orbitasi animatsiyasi', 'Tabiiy fanlar', 'Quyosh tizimi', '5-sinf', 'uz', 'solar-system'),
    mat('mat_earth', 'inst_school', 'Yer va Oy: kun, tun, oy fazalari', 'Tabiiy fanlar', 'Quyosh tizimi', '5-sinf', 'uz', 'earth-moon'),
    mat('mat_leaf', 'inst_school', 'Barg tuzilishi va xlorofill', 'Biologiya', 'Fotosintez', '7-sinf', 'uz', 'leaf'),
    mat('mat_photo', 'inst_school', 'Fotosintez jarayoni sxemasi', 'Biologiya', 'Fotosintez', '7-sinf', 'uz', 'photosynthesis'),
    mat('mat_frac', 'inst_school', 'Kasrlar: pitsa modeli', 'Matematika', 'Kasrlar', '5-sinf', 'uz', 'fractions'),
    mat('mat_water', 'inst_school', 'Suvning aylanishi', 'Tabiiy fanlar', 'Suv', '5-sinf', 'uz', 'water-cycle'),
    mat('mat_colors', 'inst_kg', 'Kamalak ranglari', 'Rivojlantiruvchi', 'Ranglar', '5–6 yosh', 'uz', 'colors'),
    mat('mat_count', 'inst_kg', 'Olmalarni sanaymiz', 'Rivojlantiruvchi', 'Sanash', '5–6 yosh', 'uz', 'counting'),
    mat('mat_neuron', 'inst_uni', 'Модель искусственного нейрона', 'ML', 'Нейронные сети', '3 курс', 'ru', 'neuron'),
    mat('mat_net', 'inst_uni', 'Прямое распространение в сети', 'ML', 'Нейронные сети', '3 курс', 'ru', 'neural-net'),
    mat('mat_grad', 'inst_uni', 'Градиентный спуск', 'ML', 'Обучение', '3 курс', 'ru', 'gradient'),
    { id: 'mat_draft', institutionId: 'inst_school', title: 'Vulqonlar (qoralama)', subject: 'Tabiiy fanlar', topic: 'Yer', level: '6-sinf', language: 'uz', type: 'pdf', visual: null, source: 'O‘qituvchi yuklagan', rights: 'Tekshirilmoqda', status: 'pending' as const },
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
      id: 'les_frac', institutionId: 'inst_school', subjectId: 'sub_math', groupIds: ['grp_5a'], language: 'uz',
      title: 'Kasrlar', durationMin: 20, status: 'published',
      sampleQuestions: ['Surat va maxraj nima?', 'Qaysi biri katta: yarim yoki chorak?', 'Kasrni qanday qisqartiramiz?'],
      greeting: 'Assalomu alaykum! Bugun mazali misol — pitsa yordamida kasrlarni o‘rganamiz.',
      sections: [
        {
          title: 'Kasr nima?', materialId: 'mat_frac',
          sentences: [
            'Tasavvur qiling, bizda bitta butun pitsa bor.',
            'Uni to‘rtta teng bo‘lakka bo‘lsak, har bir bo‘lak to‘rtdan bir qism bo‘ladi.',
            'Kasr ikki qismdan iborat: chiziq ustidagi son — surat, chiziq ostidagi son — maxraj.',
            'Maxraj butun nechta teng bo‘lakka bo‘linganini, surat esa nechta bo‘lak olinganini bildiradi.',
          ],
        },
        {
          title: 'Kasrlarni taqqoslash', materialId: 'mat_frac',
          sentences: [
            'Maxraji bir xil kasrlardan surati kattasi katta bo‘ladi.',
            'Masalan, to‘rtdan uch — to‘rtdan birdan katta.',
            'Surati bir xil bo‘lsa, maxraji kichigi katta: yarim pitsa chorak pitsadan ko‘p!',
          ],
        },
      ],
      quiz: [
        { q: 'Pitsa 8 bo‘lakka bo‘lindi, 3 bo‘lagi yeyildi. Qaysi kasr?', options: ['3/8', '8/3', '5/8'], answer: 0, explain: 'To‘g‘ri javob — sakkizdan uch.' },
        { q: 'Qaysi kasr katta?', options: ['1/4', '1/2', '1/8'], answer: 1, explain: 'Yarim, ya’ni ikkidan bir eng katta.' },
      ],
      faq: [
        { keys: ['surat', 'maxraj', 'nima'], a: 'Surat — chiziq ustidagi son, nechta bo‘lak olinganini ko‘rsatadi. Maxraj — chiziq ostidagi son, butun nechta teng bo‘lakka bo‘linganini ko‘rsatadi.' },
        { keys: ['qisqartir', 'qisqartiramiz'], a: 'Kasrni qisqartirish uchun surat va maxrajni bir xil songa bo‘lamiz. Masalan, to‘rtdan ikki — ikkidan birga teng.' },
        { keys: ['yarim', 'chorak', 'katta'], a: 'Yarim — ikkidan bir, chorak — to‘rtdan bir. Yarim katta, chunki butun kamroq bo‘lakka bo‘lingan.' },
      ],
    },
    {
      id: 'les_water', institutionId: 'inst_school', subjectId: 'sub_nature', groupIds: ['grp_5a', 'grp_7b'], language: 'uz',
      title: 'Suvning tabiatda aylanishi', durationMin: 20, status: 'published',
      sampleQuestions: ['Bulut nimadan iborat?', 'Qor qanday hosil bo‘ladi?', 'Suv qayerga ketadi?'],
      greeting: 'Salom, do‘stlar! Bugun bir tomchi suvning sayohatini kuzatamiz.',
      sections: [
        {
          title: 'Bug‘lanish va bulutlar', materialId: 'mat_water',
          sentences: [
            'Quyosh dengiz, ko‘l va daryolardagi suvni isitadi.',
            'Isigan suv bug‘ga aylanib, havoga ko‘tariladi — bu bug‘lanish deyiladi.',
            'Yuqorida havo sovuq, shuning uchun bug‘ mayda tomchilarga aylanib, bulut hosil qiladi.',
          ],
        },
        {
          title: 'Yog‘ingarchilik va qaytish', materialId: 'mat_water',
          sentences: [
            'Tomchilar kattalashib og‘irlashgach, yomg‘ir yoki qor bo‘lib yerga tushadi.',
            'Suv daryolar va yer osti orqali yana dengizga qaytadi.',
            'Shunday qilib, suv to‘xtovsiz aylanib turadi!',
          ],
        },
      ],
      quiz: [
        { q: 'Suvning bug‘ga aylanishi nima deyiladi?', options: ['Muzlash', 'Bug‘lanish', 'Erish'], answer: 1, explain: 'To‘g‘ri — bug‘lanish.' },
        { q: 'Bulut nimadan iborat?', options: ['Paxtadan', 'Mayda suv tomchilaridan', 'Tutundan'], answer: 1, explain: 'Bulut mayda suv tomchilari va muz kristallaridan iborat.' },
      ],
      faq: [
        { keys: ['bulut', 'nimadan', 'iborat'], a: 'Bulut juda mayda suv tomchilari yoki muz kristallaridan iborat. Ular shunchalik yengilki, havoda suzib yuradi.' },
        { keys: ['qor', 'hosil'], a: 'Havo juda sovuq bo‘lsa, bulutdagi suv muz kristallariga aylanadi va qor bo‘lib yog‘adi.' },
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
    { id: 'sch_5', institutionId: 'inst_school', groupId: 'grp_5a', lessonId: 'les_frac', day: 'Chorshanba', time: '09:00', room: '204-xona' },
    { id: 'sch_2', institutionId: 'inst_school', groupId: 'grp_7b', lessonId: 'les_photo', day: 'Seshanba', time: '10:00', room: '311-xona' },
    { id: 'sch_3', institutionId: 'inst_kg', groupId: 'grp_lola', lessonId: 'les_colors', day: 'Har kuni', time: '10:30', room: 'O‘yin xonasi' },
    { id: 'sch_4', institutionId: 'inst_uni', groupId: 'grp_ai21', lessonId: 'les_nn', day: 'Среда', time: '13:30', room: 'Auditoriya 4.12' },
  ];

  return {
    institutions, departments, groups, students, subjects, materials, lessons, devices, schedule,
  };
}
