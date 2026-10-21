# AI Teacher — demo (MVP)

Bog‘cha, maktab va universitetlar uchun virtual o‘qituvchi platformasi. Texnik topshiriq (TZ v1.0) asosidagi to‘liq demo:
**AI Teacher Classroom** (dars o‘tkazish) va **AI Teacher Admin** (boshqaruv).

## Ishga tushirish

```bash
npm start            # http://localhost:3000   (Node.js 20+, qo‘shimcha paket shart emas)
npm test             # holat mashinasi, huquqlar, izolyatsiya, Ilova A ssenariysi
```

| Sahifa | Manzil |
|---|---|
| Bosh sahifa | `/` |
| Classroom | `/classroom` |
| Admin panel | `/admin` (alohida login, huquqlar serverda tekshiriladi) |

**Server ishlamasa ham** sahifalarni oddiy statik hosting (masalan GitHub Pages, `npx serve .`) orqali ochish mumkin:
platforma kodi brauzerda ishlaydi, ma’lumotlar `localStorage`’da saqlanadi (sahifa pastida "Oflayn demo rejimi" yozuvi chiqadi).

### Demo hisoblar

| Login | Parol | Rol |
|---|---|---|
| `superadmin` | `Admin#2026` | Platforma Super Admini |
| `maktab.admin` | `Admin#2026` | Maktab administratori |
| `director` | `Director#2026` | Direktor (faqat hisobotlar) |
| `teacher` | `Teacher#2026` | Maktab o‘qituvchisi (5-A, 7-B) |
| `bogcha` | `Teacher#2026` | Bog‘cha tarbiyachisi (bolalar rejimi) |
| `professor` | `Teacher#2026` | Universitet o‘qituvchisi (rus tilida dars) |
| `tech` | `Tech#2026` | Texnik xodim (faqat qurilmalar) |

### Claude orqali javoblar (ixtiyoriy)

```bash
npm install                      # @anthropic-ai/sdk
ANTHROPIC_API_KEY=... npm start  # savollarga Claude javob beradi
```

Kalit bo‘lmasa, AI faqat tasdiqlangan dars materiallari va FAQ asosida oflayn javob beradi; mavzudan tashqari savollarni
o‘qituvchiga yo‘naltiradi. Claude’ga faqat dars matni va savol yuboriladi — o‘quvchilarning ismlari yuborilmaydi.
Model: `claude-opus-5-5` (o‘zgartirish: `AI_TEACHER_MODEL`).

## Jonli avatar (o‘qituvchi rasmidan)

`public/js/avatar.js` — bitta portret rasmidan WebGL orqali "tirik" o‘qituvchi:

- **Lab sinxronizatsiyasi**: matndan vizemalar (a/o/u/e/m-b-p/f-v…) hosil qilinadi va TTS so‘z chegaralari bilan sinxronlanadi;
  og‘iz ichi (tishlar, til, soya) sheyderda chiziladi.
- **Ko‘z qisish** (ba’zan ikki marta), **nigoh harakati**, **qosh ko‘tarish** (urg‘u va savollarda), **tabassum**,
  **bosh harakati** (bosh irg‘ash, tinglashda bosh egish, yengil burilish parallaksi), **nafas olish**.
- **Xarizma**: Admin → Avatar studiyasi’da ekspressivlik darajasi; bog‘cha rejimida ko‘proq tabassum, universitetda vazminroq.
- Sahna effektlari: yorug‘lik, gapirganda kamera yaqinlashuvi, tinglash halqasi, subtitrlar, "lower third" nom yozuvi.

**O‘z rasmingizni qo‘yish:** Admin → *Avatar studiyasi* → *Yangi rasm yuklash* → ko‘z, og‘iz burchaklari, lablar orasi,
iyak va bo‘yin nuqtalarini surib moslang → *Saqlash*. Eng yaxshi natija: yuz to‘g‘riga qaragan, og‘iz yopiq, fon shaffof (PNG/WebP),
yuqori sifatli surat. Mashhur shaxs yuzidan foydalanish uchun uning yozma roziligi talab qilinadi.

Keyingi bosqich (TZ §9, 3-daraja) uchun avatar dvigateli almashtiriladigan qilib yozilgan: xuddi shu `speak/syncTo/setMood`
interfeysi orqali video-avatar xizmatlari (masalan, real vaqtli neyron talking-head) ulanishi mumkin.

## Ovoz

Brauzerning Text-to-Speech va Speech-to-Text imkoniyatlari ishlatiladi (`public/js/speech.js`, almashtiriladigan provayder).
O‘zbekcha tabiiy ovozlar **Microsoft Edge**’da mavjud (Madina/Sardor Neural). Kerakli tilda ovoz bo‘lmasa, yaqin ovoz yoki
subtitrlar rejimi ishlatiladi — dars to‘xtamaydi. TZ §7 talabiga ko‘ra, har bir til real uskunada sinovdan o‘tkazilishi kerak.

## TZ bo‘yicha qamrov

| TZ bo‘limi | Amalga oshirilgan |
|---|---|
| §2.1 Classroom | muassasa/guruh/dars tanlash, start/pauza/davom/yakun, avatar, reja, materiallar, ovozli savol, davomat, test, holat indikatorlari, qo‘lda boshqaruv |
| §2.2 Admin | muassasalar, kafedralar, guruhlar, foydalanuvchilar (bloklash/tiklash), o‘quvchilar, fanlar, darslar muharriri, materiallar + moderatsiya, jadval, qurilmalar, hisobotlar (CSV), avatar va AI sozlamalari, audit jurnali; qidiruv, filtr, sahifalash, xavfli amallarni tasdiqlash |
| §3 Rollar | Super Admin, muassasa admini, direktor, o‘qituvchi, texnik xodim; har bir so‘rovda serverda tekshiruv; muassasalar izolyatsiyasi |
| §4 Muassasa turlari | bitta kod bazasi; bog‘cha (katta tugmalar, yorqin), maktab, universitet rejimlari |
| §5–6 Dars ssenariysi | aniq holat mashinasi (`shared/lessonMachine.js`): READY → CHECKING_ATTENDANCE → TEACHING ⇄ LISTENING_FOR_QUESTION → ANSWERING → CHECKING_FOLLOW_UP → KNOWLEDGE_CHECK → COMPLETED, + PAUSED_BY_TEACHER, RECOVERY; pozitsiya saqlanadi, takroriy start himoyasi |
| §7 Ovoz | STT/TTS, "Ustoz" chaqiruv so‘zi (ixtiyoriy), tanilgan savolni tasdiqlash, ovozsiz rejim |
| §8 Kamera | faqat sinov/ko‘rish, faollik indikatori, yozib olinmaydi, yuzni aniqlash yo‘q — davomat qo‘lda |
| §9 Materiallar | animatsiyalar kutubxonasi (Quyosh, sayyoralar, Yer–Oy, barg, fotosintez, ranglar, sanash, neyron, tarmoq, gradiyent), metama’lumotlar, moderatsiya |
| §13 Xavfsizlik | PBKDF2 parol xeshlari, HttpOnly/SameSite cookie, login urinishlari cheklovi, audit, CSRF himoyasi |
| §14 Ishonchlilik | sahifa yangilansa yoki aloqa uzilsa dars shu joydan tiklanadi; subtitrlar, matn o‘lchami, ovoz balandligi |

## Tuzilma

```
server/       HTTP adapter (Node, freymvorksiz) + Claude provayderi
shared/       platforma yadrosi: ma’lumotlar, huquqlar, API, holat mashinasi, oflayn javoblar (server ham, brauzer ham ishlatadi)
public/       Classroom, Admin, avatar dvigateli, vizual materiallar
tests/        node:test testlari
```

Production uchun (TZ §11): PostgreSQL, Redis, obyekt ombori, MFA, markazlashgan loglar — `shared/platform.js`dagi
`persist`/`data` qatlamini DB repozitoriysiga almashtirish orqali.
