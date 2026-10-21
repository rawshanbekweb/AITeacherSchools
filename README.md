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
APP_SECRET=$(openssl rand -hex 32) docker compose up --build  # http://localhost:3000
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
| `APP_SECRET` | MFA sirlarini shifrlash kaliti (productionda majburiy). Bo‘lmasa dev uchun `data/.app-secret` yaratiladi. |
| `REQUIRE_MFA_FOR_ADMINS` | `true` — Super Admin va muassasa adminlari MFA’ni yoqmaguncha hech narsa qila olmaydi. |

## Jonli avatar va qo‘l harakatlari

`src/lib/client/avatar.ts` — o‘qituvchining o‘z surati va video kliplaridan WebGL orqali jonli avatar:
vizemalar asosida lab sinxronizatsiyasi (og‘iz ichi, tishlar), ko‘z qisish, nigoh, qosh, tabassum, bosh irg‘ash/egish,
burilish parallaksi, nafas va butun tananing tebranishi. Neyron TTS ulanganda og‘iz audio amplitudasidan harakatlanadi.

**Qo‘l harakatlari (ishoralar kutubxonasi).** Bitta suratdan qo‘llarni "ochib" bo‘lmaydi — qo‘l ortidagi tana rasmda yo‘q.
Shuning uchun avatar o‘qituvchining **qo‘shimcha suratlari yoki qisqa video kliplari**dan foydalanadi:

| Vazifa | Qachon ishlatiladi |
|---|---|
| Tinch holat (video) | doimiy fon harakati — surat o‘rniga "tirik" kadr |
| Salomlashish | dars boshida |
| Tushuntirish | yangi bo‘lim, savol shaklidagi va ba’zi oddiy gaplarda |
| Doskaga ko‘rsatish | «qarang», «mana», «rasmda», «смотрите» kabi so‘zlarda |
| O‘ylash / Tinglash | AI javob tayyorlayotganda / savol tinglayotganda |
| Maqtash | «barakalla», «ofarin», to‘g‘ri javobda |

Pozalar yuz nuqtalari bo‘yicha avtomatik moslashtiriladi va silliq almashadi; video kliplarda yuz har kadrda kuzatiladi,
shuning uchun ishora paytida ham lab sinxronizatsiyasi ishlaydi.

**Admin → Avatar studiyasi:** rasm yoki video yuklang → yuz nuqtalari MediaPipe bilan **avtomatik** aniqlanadi (brauzerda,
tashqi serverga yuborilmaydi) → videoda «Kadrlarni kuzatish» → kerak bo‘lsa «Fonni olib tashlash» (rasm) yoki xromakey
(yashil/ko‘k fonli video) → vazifasini tanlang → *Saqlash*. Prevyuda har bir ishorani sinab ko‘rish mumkin.

**Suratga olish bo‘yicha tavsiyalar:** kamera shtativda, kadr va yorug‘lik barcha pozalarda bir xil; bel yoki tizzagacha,
qo‘llar kadrga to‘liq sig‘sin; og‘iz yopiq; klip 2–5 soniya — tinch holatdan boshlanib, ishora qilib, yana tinch holatga
qaytsin; fon bir xil rangli devor. Mashhur shaxs yuzi uchun uning yozma roziligi kerak.

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

**Xavfsizlik** (TZ §3, §13): ikki bosqichli kirish (TOTP — Google/Microsoft Authenticator, Aegis; sirlar AES-256-GCM
bilan shifrlangan, kodni takrorlash bloklangan, admin yo‘qolgan telefon uchun MFA’ni tiklay oladi; `REQUIRE_MFA_FOR_ADMINS`
bilan adminlarga majburiy); Admin → *Profil va xavfsizlik*da parol almashtirish (boshqa seanslar yopiladi); parollar scrypt bilan xeshlanadi; sessiya tokeni bazada faqat SHA-256 xesh ko‘rinishida;
HttpOnly/SameSite/Secure cookie; login urinishlari cheklangan; har bir API so‘rovda rol va muassasa serverda tekshiriladi
(boshqa muassasa obyekti — 404); mijoz yuborgan `institutionId` inobatga olinmaydi; Zod validatsiya; cross-origin
so‘rovlar rad etiladi; audit jurnali; texnik xodim shaxsiy ma’lumotlarni ko‘rmaydi.

## Zaxira nusxa va tiklash (TZ §13)

```bash
DATABASE_URL=postgres://… ./scripts/backup.sh backups          # pg_dump + yuklangan fayllar
DATABASE_URL=postgres://… ./scripts/restore.sh backups/<sana>   # pg_restore --clean (ilovani to‘xtatib)
```

DATABASE_URL bo‘lmasa (PGlite), `data/pglite` katalogi arxivlanadi. Zaxira → o‘chirish → tiklash sikli PostgreSQL 16 da
sinab ko‘rilgan; productionda tiklashni muntazam (masalan, oyiga bir marta) sinov bazasida tekshirib turing.

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
| §13 MFA | ✅ TOTP, majburiy qilish siyosati, admin tomonidan tiklash; zaxira/tiklash skriptlari |
| §9 3-daraja | ✅ ishoralar kutubxonasi (surat/video), yuz kuzatuvi, lab sinxronizatsiyasi. ⏳ generativ neyron video-avatar — keyingi tadqiqot bosqichi |
