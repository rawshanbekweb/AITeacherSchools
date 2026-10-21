// End-to-end smoke test of Appendix A in a real browser (Playwright).
// Usage: npm run build && npm start   (fresh database), then: node scripts/e2e.mjs [screenshot-dir]
import fs from 'node:fs';
import { chromium } from 'playwright';
const out = process.argv[2] || 'data/e2e';
fs.mkdirSync(out, { recursive: true });
const B = process.env.BASE || 'http://localhost:3000';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
p.on('dialog', d => d.accept());
const shot = (n) => p.screenshot({ path: `${out}/n_${n}.png` });
const waitState = (s, t=60000) => p.waitForFunction(s => document.querySelector('.state-pill')?.dataset.s === s, s, { timeout: t });
await p.goto(B + '/'); await p.waitForTimeout(2500); await shot('0_landing');
await p.goto(B + '/classroom');
await p.fill('input[autocomplete=username]', 'teacher'); await p.fill('input[type=password]', 'Teacher#2026');
await p.click('button:has-text("Kirish")');
await p.waitForSelector('text=Darsni tanlang', { timeout: 30000 }); await p.waitForTimeout(2000); await shot('1_setup');
await p.locator('select').last().selectOption('les_solar'); await p.waitForTimeout(400); await p.click('button:has-text("Darsni boshlash")');
await waitState('CHECKING_ATTENDANCE'); await p.waitForTimeout(2000); await shot('2_attendance');
await p.click('button:has-text("Hammasi bor")');
await p.click('.att:nth-child(3) button[data-v=absent]');
await p.click('button:has-text("Tasdiqlash")');
await waitState('TEACHING'); await p.waitForTimeout(6000); await shot('3_teaching');
await p.click('.ctl:has-text("Savol berish")');
await waitState('LISTENING_FOR_QUESTION'); await p.waitForTimeout(1500); await shot('4_listening');
await p.click('.chips button:first-child');
await waitState('ANSWERING'); await p.waitForTimeout(3000); await shot('5_answering');
await waitState('CHECKING_FOLLOW_UP'); await shot('6_follow');
await p.click('.panel button:has-text("Yo‘q")');
await waitState('TEACHING');
console.log('resumed at', await p.$eval('.plan .step.current b', e => e.textContent));
for (let i=0;i<3;i++){ await p.click('.ctl:has-text("Keyingi")'); await p.waitForTimeout(i===0?4000:800); if(i===0) await shot('7_section2'); }
await waitState('KNOWLEDGE_CHECK'); await p.waitForTimeout(6000); await shot('8_quiz');
for (let i=0;i<3;i++) {
  await p.waitForSelector('.quiz-options button');
  await p.click(`.quiz-options button:nth-child(${i===1?3:2})`);
  if (i<2) await p.waitForFunction(n => document.querySelector('.panel .badge')?.textContent.startsWith(String(n)), i+2, { timeout: 60000 });
}
await waitState('COMPLETED'); await p.waitForTimeout(2500); await shot('9_summary');
// admin as the school admin
const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } }); const a = await ctx2.newPage();
a.on('pageerror', e => console.log('ADMIN PAGEERROR:', e.message)); a.on('dialog', d => d.accept());
await a.goto(B + '/admin'); await a.fill('input[autocomplete=username]', 'maktab.admin'); await a.fill('input[type=password]', 'Admin#2026'); await a.click('button:has-text("Kirish")');
await a.waitForSelector('text=Xush kelibsiz'); await a.waitForTimeout(800); await a.screenshot({ path: `${out}/a_1_dash.png` });
for (const pg of ['users','lessons','materials','audit','students','reports']) { await a.goto(B + '/admin/' + pg); await a.waitForTimeout(1500); console.log(pg, (await a.$$('tbody tr')).length); }
await a.goto(B + '/admin/reports'); await a.click('tbody a:has-text("Hisobot")'); await a.waitForTimeout(1200); await a.screenshot({ path: `${out}/a_2_report.png` });
await a.goto(B + '/admin/lessons/les_solar'); await a.waitForTimeout(1500); await a.screenshot({ path: `${out}/a_3_lesson.png` });
await a.goto(B + '/admin/users'); await a.waitForTimeout(1000); await a.click('button:has-text("Qo‘shish")'); await a.waitForTimeout(500); await a.screenshot({ path: `${out}/a_4_form.png` });
await a.goto(B + '/admin/avatar'); await a.waitForTimeout(3000); await a.screenshot({ path: `${out}/a_5_avatar.png` });
await a.goto(B + '/admin/institutions'); await a.waitForTimeout(1000); console.log('inst rows', (await a.$$('tbody tr')).length);
await a.goto(B + '/admin/lessons/les_nn'); await a.waitForTimeout(1000); console.log('foreign lesson 404?', await a.$('text=Sahifa topilmadi') !== null);
await b.close();
