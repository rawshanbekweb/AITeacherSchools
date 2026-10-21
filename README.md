# AI Teacher

Bog‘cha, maktab va universitetlar uchun virtual o‘qituvchi platformasi — TZ v1.0 asosida.
Ikki interfeys: **Classroom** (darsni AI olib boradi) va **Admin** (boshqaruv).

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Drizzle ORM · PostgreSQL (lokalda o‘rnatilgan PGlite) ·
Zod · Claude API (ixtiyoriy) · Azure neyron TTS (ixtiyoriy) · WebGL avatar · Vitest + Playwright.

## Tez ishga tushirish

```bash
npm install
npm run dev                # http://localhost:3000 — baza avtomatik yaratiladi (./data/pglite) va demo ma’lumotlar bilan to‘ldiriladi
```

Production:

```bash
npm run build && npm start
# yoki to‘liq stek PostgreSQL bilan:
docker compose up --build  # http://localhost:3000
```

| Sahifa | Manzil |
|---|---|
| Bosh sahifa | `/` |
| Classroom | `/classroom` (kirish: `/login`) |
| Admin panel | `/admin` (alohida kirish: `/admin/login`) |

### Demo hisoblar

| Login | Parol | Rol |
|---|---|---|
| `superadmin` | `Admin#2026` | Platforma Super Admini (barcha muassasalar) |
| `maktab.admin` | `Admin#2026` | Maktab administratori |
| `director` | `Director#2026` | Direktor (hisobotlar) |
| `teacher` | `Teacher#2026` | Maktab o‘qituvchisi (5-A, 7-B) |
| `bogcha` | `Teacher#2026` | Bog‘cha tarbiyachisi (bolalar rejimi) |
| `professor` | `Teacher#2026` | Universitet (rus tilidagi dars) |
| `tech` | `Tech#2026` | Texnik xodim (faqat qurilmalar) |

Productionda `SEED_DEMO_DATA=false` qo‘ying va birinchi Super Adminni yarating (yoki demo parollarni darhol almashtiring).

## Muhit o‘zgaruvchilari (`.env.example`)

| O‘zgaruvchi | Vazifasi |
|---|---|
| `DATABASE_URL` | PostgreSQL. Bo‘sh bo‘lsa — o‘rnatilgan PGlite (`./data/pglite`). Migratsiyalar ishga tushganda avtomatik qo‘llanadi. |
| `ANTHROPIC_API_KEY` | Savollarga Claude javob beradi (`claude-opus-5-5`, `AI_TEACHER_MODEL` bilan o‘zgartiriladi). Bo‘lmasa — tasdiqlangan dars materiallaridan oflayn javob. |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Serverdagi neyron ovoz: `uz-UZ-SardorNeural/MadinaNeural`, `ru-RU-DmitryNeural`… Avatar lablari haqiqiy audio signalga moslashadi. Bo‘lmasa — brauzer ovozi. |
| `UPLOAD_DIR` | Yuklangan material fayllari (faqat ruxsatli `/api/files/[id]` orqali beriladi). |
| `SEED_DEMO_DATA` | `false` — bo‘sh bazaga demo ma’lumot qo‘shilmaydi. |

## Jonli avatar

`src/lib/client/avatar.ts` — bitta portretdan WebGL sheyder orqali gapiradigan o‘qituvchi: vizemalar asosida lab
sinxronizatsiyasi (og‘iz ichi, tishlar), ko‘z qisish, nigoh, qosh, tabassum, bosh irg‘ash/egish, burilish parallaksi, nafas.
Neyron TTS ulanganda og‘iz ochilishi audio amplitudasidan olinadi.

**O‘z rasmingiz:** Admin → *Avatar studiyasi* → *Yangi rasm* → ko‘z, og‘iz, iyak, bo‘yin nuqtalarini surib moslang →
*Saqlash*. Eng yaxshi natija: yuz to‘g‘riga qaragan, og‘iz yopiq, fon shaffof PNG/WebP. Mashhur shaxs yuzi uchun uning yozma
roziligi kerak.

## Arxitektura

```
src/
  app/                    sahifalar va API (route handlers)
    api/…                 REST: auth, [entity] CRUD, sessions, ai/answer, tts, files, avatar, dashboard, health
    classroom/            Classroom (server guard + client ilova)
    admin/(panel)/…       Admin: dashboard, [entity], lessons/[id], reports, avatar
  proxy.ts                kirmagan foydalanuvchini login sahifasiga yo‘naltirish (faqat UX; huquq serverda tekshiriladi)
  db/                     Drizzle sxemasi, ulanish (PostgreSQL | PGlite), demo seed
  lib/core/               server+client: tiplar, dars holat mashinasi, oflayn javoblar, seed ma’lumotlari
  lib/server/             auth (scrypt, sessiya tokeni xeshi), RBAC + muassasa izolyatsiyasi (crud.ts), dars xizmatlari,
                          AI (Claude), TTS (Azure), fayl ombori, audit
  lib/client/             avatar dvigateli, ovoz (TTS/STT), vizual materiallar, LessonController
  components/             UI: classroom, admin, umumiy
drizzle/                  SQL migratsiyalar (`npm run db:generate` sxema o‘zgarganda)
tests/                    Vitest: holat mashinasi, huquqlar, izolyatsiya, Ilova A ssenariysi (haqiqiy SQL, PGlite)
scripts/e2e.mjs           Playwright: to‘liq dars + admin brauzerda
```

**Dars holat mashinasi** (`src/lib/core/lessonMachine.ts`, TZ §6): READY → CHECKING_ATTENDANCE → TEACHING ⇄
LISTENING_FOR_QUESTION → ANSWERING → CHECKING_FOLLOW_UP → KNOWLEDGE_CHECK → COMPLETED, + PAUSED_BY_TEACHER va RECOVERY.
Holat har o‘zgarishda serverga saqlanadi; sahifa yangilansa yoki aloqa uzilsa dars aynan shu joydan tiklanadi.

**Xavfsizlik** (TZ §3, §13): parollar scrypt bilan xeshlanadi; sessiya tokeni bazada faqat SHA-256 xesh ko‘rinishida;
HttpOnly/SameSite/Secure cookie; login urinishlari cheklangan; har bir API so‘rovda rol va muassasa serverda tekshiriladi
(boshqa muassasa obyekti — 404); mijoz yuborgan `institutionId` inobatga olinmaydi; Zod validatsiya; cross-origin
so‘rovlar rad etiladi; audit jurnali; texnik xodim shaxsiy ma’lumotlarni ko‘rmaydi.

## Tekshiruvlar

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run test:e2e        # ishlab turgan serverga qarshi (BASE=http://localhost:3000), yangi baza bilan
```

## TZ bo‘yicha holat

| Bo‘lim | Holat |
|---|---|
| §2.1 Classroom | ✅ tanlash, start/pauza/davom/yakun, avatar, reja, materiallar, ovozli savol, davomat, test, indikatorlar, qo‘lda boshqaruv, klaviatura yorliqlari |
| §2.2 Admin | ✅ muassasa, bo‘lim, guruh, foydalanuvchi (bloklash), o‘quvchi, fan, dars muharriri, material + moderatsiya + fayl, jadval, qurilma, hisobot (CSV/chop), avatar, audit; qidiruv, filtr, sahifalash, xavfli amal tasdig‘i |
| §3 Rollar | ✅ server tomonida, muassasalar izolyatsiyasi |
| §4 Muassasa turlari | ✅ bitta kod bazasi, bog‘cha/maktab/universitet rejimlari |
| §5–6 Ssenariy | ✅ aniq holat mashinasi, pozitsiyani saqlash, takroriy start himoyasi, tiklanish |
| §7 Ovoz | ✅ brauzer STT/TTS + server neyron TTS, chaqiruv so‘zi, tanilgan savolni tasdiqlash. ⚠ Tillar real uskunada sinalishi kerak |
| §8 Kamera | ✅ sinov/ko‘rish, yozib olinmaydi, yuzni aniqlash yo‘q (TZ talabi bo‘yicha alohida bosqich) |
| §9 Materiallar | ✅ 12 ta animatsion sahna, metama’lumotlar, moderatsiya |
| §11 Arxitektura | ✅ Next.js + PostgreSQL + alohida AI moduli; Docker, CI |
| §13 MFA | ⏳ keyingi bosqich (imtiyozli hisoblar uchun TOTP) |
| §9 3-daraja | ⏳ neyron video-avatar provayderi (avatar interfeysi `speak/speakAudio/setMood` orqali ulanadi) |
