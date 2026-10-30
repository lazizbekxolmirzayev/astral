# Loyiha daftari

Har yangi sessiyada avval shu faylni o'qing: butun saytni qayta ko'rib chiqish shart emas.
Har bir ishdan keyin yangilanadi.

Oxirgi yangilanish: 2026-10-30

## Maqsad

Hozirgi NEXUS loyihasini **2026 NASA Space Apps Challenge** uchun **Space Mission Design Game** o'yiniga aylantirish.

Challenge talabi: o'yinchi butun missiyani loyihalaydi, boshqaradi va simulyatsiya qiladi. Har bir qaror boshqa qismlarga ta'sir qilishi, o'yinchi esa missiya nega muvaffaqiyatli bo'lgani yoki barbod bo'lganini tushunishi kerak. Faqat orbita simulyatori yetarli emas.

Resurslar: massa, quvvat, byudjet, ma'lumot, aloqa, vaqt.

## Hozirgi holat

O'yin ishlaydi: bosh sahifada (`/`) to'liq yo'l bor, maqsaddan hisobotgacha. Eski koinot ko'rinishi `/universe` da.

- Stek: Next.js 16 (App Router), React 19, three.js / React Three Fiber, zustand, next-intl, Vitest.
- Bu Next.js versiyasi boshqacha: kod yozishdan oldin `node_modules/next/dist/docs/` ni o'qing (`AGENTS.md`).
- O'yin MongoDB'siz ishlaydi. Natijalar brauzerning localStorage'ida saqlanadi.

## O'yin kodi qayerda

| Joy | Vazifasi |
|---|---|
| `src/mission/physics.ts` | Haqiqiy formulalar: raketa tenglamasi, Kepler, quyosh quvvati, Friis aloqa, Hohmann |
| `src/mission/data.ts` | Missiyalar, orbitalar, raketalar, qismlar va asboblar. Balans shu yerda |
| `src/mission/analysis.ts` | Dizaynni hisoblash, muammolar ro'yxati |
| `src/mission/simulate.ts` | Kunma-kun parvoz va tasodifiy hodisalar. Bir xil seed bir xil natija beradi |
| `src/mission/score.ts` | Ochko, rol vazifalari, «nega shunday bo'ldi» izohlari |
| `src/mission/mission.test.ts` | Formulalar va har bir missiyani yutish mumkinligini tekshiradi |
| `src/stores/missionStore.ts` | O'yin holati, urinishlar tarixi |
| `src/components/mission/` | Ekranlar, resurslar paneli, 3D sahna |
| `src/messages/*.json` → `mission` | `uz/ru/en` matnlari |
| `src/messages/messages.test.ts` | Tarjima kalitlari va buzilgan matnni tekshiradi |
| `e2e/mission.spec.mjs` | Brauzerda to'liq o'yin yo'li |

Yangi qism yoki orbita qo'shilsa: `data.ts` ga va uchala tarjimaga qo'shing, aks holda test yiqiladi.

## Qilingan ishlar

- [x] Eski xatolar: `typecheck` xatosi, `PulsarExperience` lint xatosi, 3 ta eskirgan test.
- [x] Tarjimalardagi 500 ga yaqin buzilgan matn tiklandi (ru deyarli butunlay buzilgan edi).
- [x] `src/mission/`: hisob yadrosi va testlari.
- [x] Ma'lumotlar: 4 missiya, 9 orbita, 5 raketa, 24 qism, 8 asbob.
- [x] 7 bosqich: maqsad, apparat, asboblar, orbita va raketa, tekshiruv, parvoz, hisobot.
- [x] Jonli resurslar paneli, soddalashtirilgan izohlar va tasodifiy hodisalar.
- [x] 3D parvoz: haqiqiy Hohmann ellipsi va orbitadagi apparat.
- [x] Hisobot: ochko, sabablar, urinishlarni solishtirish, qayta loyihalash.
- [x] Jamoa rejimi: 4 rol, navbat, shaxsiy vazifalar, hammaning tasdig'i, jamoa bonusi.
- [x] Til almashtirgich o'yin sahifasida; `uz/ru/en` to'liq.
- [x] Bosh sahifa o'yinga o'tkazildi, navigatsiya va orqaga havolalar yangilandi.
- [x] Birinchi kirganlar uchun qo'llanma, sandbox rejimi, har missiya bo'yicha eng yaxshi natija.
- [x] Dizaynni havola orqali ulashish (`src/mission/share.ts`), kirish ma'lumoti tekshiriladi.
- [x] Yangi hodisa: uzatgich eskirishi. Mobil navigatsiya tuzatildi.

## Qilinishi kerak bo'lgan ishlar

1. [ ] Challenge sahifasidagi Resources bo'limini olish va o'yin raqamlarini NASA ma'lumotlari bilan solishtirish.
2. [ ] Hakatonga topshirish uchun demo, video va tavsif (talablari aniqlangach).
3. [ ] Internetga joylash. Hozir faqat lokal ishlaydi.
4. [ ] Vaqt qolsa: onlayn multiplayer, umumiy onlayn reyting.

## Qarorlar

- Noldan qayta yozilmadi: fizika, 3D va tarjimalar saqlandi.
- Jamoa rejimi bitta kompyuterda navbat bilan ishlaydi; onlayn multiplayer challenge'da majburiy emas.
- Raketa quvvatlari taxminiy haqiqiy qiymatlar; qismlar narxi va ilmiy ballar o'yin balansi uchun tanlangan.
- Sayt standart holda o'zbekcha ochiladi; hakamlar uchun til almashtirgich sahifaning tepasida.
- Kilo Code, Cline, Qoder va Antigravity ishlatilmaydi: ularni Claude boshqara olmaydi.

## Muddat

Topshirish muddati: taxminan 2026-11-15 (foydalanuvchi eslab aytgan, rasmiy saytda tasdiqlanmagan).

## Vositalar holati

- Codex CLI o'rnatilmagan.
- Gemini CLI bor, lekin 2026-10-30 da javob bermadi (vaqt tugadi va xato). Ruscha tarjimani Claude yozdi.

## Tekshiruv natijalari (2026-10-30)

- `typecheck`: xatosiz.
- `lint`: 0 xato, 21 ogohlantirish (eski kodda ishlatilmagan o'zgaruvchilar).
- `vitest`: 255 test o'tdi.
- `npm run build`: o'tdi.
- Playwright (`e2e/mission.spec.mjs`): 6 test production build'da o'tdi, konsolda xato yo'q.
- Tekshirilmagan: `e2e/nexus.spec.mjs`, chunki u MongoDB talab qiladi.

## Ma'lum muammolar

- `npm run dev` Turbopack'da ishlashi shart: Tailwind faqat shu orqali ulangan, `--webpack` bilan sayt dizaynsiz chiqadi.
- Dev rejimda birinchi ochilishda `/universe` 3D sahnasi taxminan 10 soniya yuklanadi. Production'da bu kechikish tekshirilmagan.
- GitHub'dagi `master` hali o'yinni o'z ichiga olmaydi; ish `mission-game` branch'ida.
- spaceappschallenge.org ni bu muhitdan ochib bo'lmadi (sertifikat xatosi): Resources va muddatni foydalanuvchi berishi kerak.
- Jamoa o'yini bonusi tufayli eng yaxshi natija 100 dan oshishi mumkin, yakka o'yin bilan to'g'ridan-to'g'ri solishtirib bo'lmaydi.
