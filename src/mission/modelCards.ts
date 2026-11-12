import { L, type Localized } from './i18n';

/**
 * Model cards: for every calculation the game will run, what it computes, which
 * equations it uses, what it assumes and what it leaves out. The UI shows these
 * next to the results so that no number is presented as more than it is.
 *
 * Status is honest: a card is `planned` until the engine that implements it exists
 * and is tested, and only then switched to `implemented` in the same change.
 * Nothing in the game is a high-fidelity mission-analysis tool; every model here is
 * an educational approximation.
 */

export const MODEL_CARD_IDS = [
  'delta-v',
  'mass-budget',
  'power-budget',
  'orbit-geometry',
  'launch-fit',
  'communications-data',
  'cost',
  'transfer-approximation',
  'scoring',
] as const;
export type ModelCardId = (typeof MODEL_CARD_IDS)[number];

export type ModelCard = {
  id: ModelCardId;
  /** Development phase in which the model is implemented. */
  phase: 2 | 4 | 5 | 6;
  status: 'planned' | 'implemented';
  /** Source file of the implementation; present exactly when the status is `implemented`. */
  implementedIn?: string;
  title: Localized;
  scope: Localized;
  /** Language-neutral formulas, written with plain symbols. */
  equations: readonly string[];
  assumptions: readonly Localized[];
  limitations: readonly Localized[];
  references: readonly string[];
};

const SMAD = 'Wertz & Larson (eds.), Space Mission Analysis and Design, 3rd ed.';
const CURTIS = 'Curtis, Orbital Mechanics for Engineering Students';
const VALLADO = 'Vallado, Fundamentals of Astrodynamics and Applications';
const SUTTON = 'Sutton & Biblarz, Rocket Propulsion Elements';

export const MODEL_CARDS: readonly ModelCard[] = [
  {
    id: 'delta-v',
    phase: 2,
    status: 'implemented',
    implementedIn: 'engine/deltaV.ts',
    title: L('Velocity change (Δv) and propellant', "Tezlik o'zgarishi (Δv) va yoqilg'i"),
    scope: L(
      'How much velocity change the spacecraft can produce with the propellant it carries, and how much propellant a required Δv needs.',
      "Apparat olib yurgan yoqilg'i bilan qancha tezlik o'zgarishi hosil qila olishi va kerakli Δv uchun qancha yoqilg'i zarurligi.",
    ),
    equations: [
      'Δv = Isp · g0 · ln(m0 / mf)',
      'm_propellant = mf · (exp(Δv / (Isp · g0)) − 1)',
      'Δv_required = (Δv_insertion + Δv_corrections + Δv_stationkeeping) · (1 + margin)',
    ],
    assumptions: [
      L('Burns are instantaneous (impulsive) and all propellant is usable.', "Yoqish bir lahzada (impulsiv) bo'ladi va barcha yoqilg'i ishlatiladi."),
      L('Specific impulse is constant for the whole burn.', "Solishtirma impuls butun yoqish davomida o'zgarmas."),
    ],
    limitations: [
      L('Gravity and drag losses during launch are not modelled; the launcher capacity table already includes them.', "Uchirishdagi tortishish va qarshilik yo'qotishlari modellashtirilmaydi; raketa sig'imi jadvali ularni o'z ichiga oladi."),
      L('Electric thrusters use the same equation but cannot do fast burns, so they are limited to small corrections.', "Elektr dvigatellar ham shu tenglamadan foydalanadi, lekin tez yoqa olmaydi, shuning uchun faqat kichik tuzatishlarga cheklangan."),
    ],
    references: [SUTTON, SMAD],
  },
  {
    id: 'mass-budget',
    phase: 2,
    status: 'implemented',
    implementedIn: 'engine/mass.ts',
    title: L('Mass budget', "Massa byudjeti"),
    scope: L(
      'Adds up the bus, parts, instruments and propellant, and compares the total with the bus payload limit and the launcher capacity.',
      "Platforma, qismlar, asboblar va yoqilg'i massasini qo'shadi va platforma yuklama chegarasi hamda raketa sig'imi bilan solishtiradi.",
    ),
    equations: ['m_total = m_bus + Σ(n_i · m_i) + m_propellant', 'margin = (m_limit − m_total) / m_limit'],
    assumptions: [
      L('Part masses are those listed in the catalog and already include their own structure.', "Qism massalari katalogdagidek va o'z konstruksiyasini o'z ichiga oladi."),
      L('A fixed mass margin is shown separately and is not added to the total.', "Massa zaxirasi alohida ko'rsatiladi va umumiy massaga qo'shilmaydi."),
    ],
    limitations: [
      L('Harness, brackets and adapters are not modelled in detail.', "Kabellar, mahkamlagichlar va adapterlar batafsil modellashtirilmaydi."),
      L('Masses are class-typical, not the specification of a real product.', "Massalar sinfga xos qiymatlar, haqiqiy mahsulot ma'lumoti emas."),
    ],
    references: [SMAD],
  },
  {
    id: 'power-budget',
    phase: 2,
    status: 'implemented',
    implementedIn: 'engine/power.ts',
    title: L('Power budget', "Quvvat byudjeti"),
    scope: L(
      'Solar power generated at the destination, the power every part draws, and whether the battery covers the time in eclipse.',
      "Manzilda hosil bo'ladigan quyosh quvvati, har bir qism sarflaydigan quvvat va batareya soya vaqtini qoplay olishi.",
    ),
    equations: [
      'S(r) = S0 / r²   (r in AU)',
      'P_gen = S(r) · A · η · cos(θ) · (1 − d)^t',
      't_eclipse ≈ T · asin(R / (R + h)) / π   (circular orbit, sun in the orbital plane)',
      'E_eclipse = P_load · t_eclipse ≤ DoD · C_battery',
      'P_required = P_load · (1 + f / ((1 − f) · η_round-trip)),  f = t_eclipse / T',
    ],
    assumptions: [
      L('Sunlight is parallel and its intensity falls with the square of the distance from the Sun.', "Quyosh nuri parallel deb olinadi va uning kuchi Quyoshgacha masofa kvadratiga teskari kamayadi."),
      L('The array is pointed at the Sun with a fixed average pointing loss.', "Panel Quyoshga doimiy o'rtacha yo'nalish yo'qotishi bilan qaratilgan."),
    ],
    limitations: [
      L('Eclipse length uses the worst case with the sun in the orbital plane; seasonal variation is not modelled.', "Soya davomiyligi eng yomon holat uchun hisoblanadi; mavsumiy o'zgarish modellashtirilmaydi."),
      L('Temperature, shadowing by the spacecraft and battery ageing are not modelled; thermal design is outside the game.', "Harorat, apparatning o'z soyasi va batareya eskirishi modellashtirilmaydi; issiqlik loyihasi o'yindan tashqarida."),
    ],
    references: [SMAD],
  },
  {
    id: 'orbit-geometry',
    phase: 4,
    status: 'implemented',
    implementedIn: 'engine/orbitReport.ts',
    title: L('Orbit geometry', "Orbita geometriyasi"),
    scope: L(
      'Orbital period, speed, ground-station distance, and the inclination that keeps an orbit sun-synchronous.',
      "Orbita davri, tezligi, yer stansiyasigacha masofa va orbitani Quyosh-sinxron qiladigan og'ish burchagi.",
    ),
    equations: [
      'a = R + (h_p + h_a) / 2',
      'T = 2π · √(a³ / μ)',
      'v = √(μ · (2 / r − 1 / a))',
      'Ω̇ = −(3/2) · J2 · (R / p)² · n · cos(i)   (sun-synchronous: Ω̇ = 360° per tropical year)',
      'cos(i_sso) = −Ω̇_sun · p² / ((3/2) · J2 · R² · n),  p = a · (1 − e²),  n = √(μ / a³)',
      'drift [min/day] = 4 · (Ω̇ − Ω̇_sun) [deg/day]   (4 minutes of local solar time per degree)',
      'd_horizon = √((R + h)² − R²)',
    ],
    assumptions: [
      L('Two-body motion around a spherical body; only the J2 term of Earth\'s gravity is used, and only for sun-synchronous orbits.', "Sferik jism atrofidagi ikki jismli harakat; Yer tortishishining faqat J2 hadi va faqat Quyosh-sinxron orbitalar uchun ishlatiladi."),
      L('The existing Kepler and orbit-readout code is reused for the maths.', "Hisob uchun mavjud Kepler va orbit-readout kodi qayta ishlatiladi."),
      L('Heliocentric orbits are read as distances from the Sun in AU, in the ecliptic frame; the inclination is measured from the ecliptic.', "Geliosentrik orbitalar Quyoshdan AU hisobidagi masofa sifatida, ekliptika sistemasida o'qiladi; og'ish ekliptikadan o'lchanadi."),
      L('Sun-synchronous thresholds (0.5° passes, 1.5° fails) are game rules; the inclination itself is physics.', "Quyosh-sinxron chegaralar (0,5° o'tadi, 1,5° o'tmaydi) o'yin qoidalari; og'ishning o'zi esa fizika."),
    ],
    limitations: [
      L('The Earth-orbit eclipse uses the Sun in the orbital plane (the longest eclipse); heliocentric orbits have no eclipse.', "Yer orbitasidagi soya Quyosh orbita tekisligida bo'lgan holat (eng uzun soya) uchun hisoblanadi; geliosentrik orbitalarda soya yo'q."),
      L('Atmospheric drag, the Moon and Sun perturbations and radiation pressure are not modelled; orbit decay is not simulated.', "Atmosfera qarshiligi, Oy va Quyosh ta'siri va nur bosimi modellashtirilmaydi; orbita pasayishi simulyatsiya qilinmaydi."),
      L('Distances are for a spherical Earth, not a real ground-station network.', "Masofalar sferik Yer uchun, haqiqiy yer stansiyalari tarmog'i uchun emas."),
    ],
    references: [VALLADO, CURTIS],
  },
  {
    id: 'launch-fit',
    phase: 2,
    status: 'implemented',
    implementedIn: 'engine/mass.ts, engine/readiness.ts',
    title: L('Launcher and launch-site compatibility', "Raketa va uchirish joyi mosligi"),
    scope: L(
      'Checks that the launch vehicle can deliver the spacecraft to the destination\'s delivery target (LEO, SSO, GTO, trans-lunar or trans-Mars).',
      "Raketa apparatni manzilning yetkazish nuqtasiga (LEO, SSO, GTO, Oyga yoki Marsga uchish) yetkaza olishini tekshiradi.",
    ),
    equations: [
      'm_spacecraft,wet ≤ C(vehicle, target)',
      'P_launch_success = reliability',
      'i_delivered = clamp(i_orbit, i_site,min, i_site,max);  shortfall = |i_orbit − i_delivered|',
      'Δv_plane = √(v1² + v2² − 2 · v1 · v2 · cos(shortfall))   (merged into the insertion burn)',
      'C3_provided ≥ C3_required   (escape targets)',
    ],
    assumptions: [
      L('Capacity is a single mass per target for each vehicle class.', "Har bir raketa sinfi uchun har bir nuqtaga bitta sig'im massasi beriladi."),
      L('The spacecraft\'s own propulsion covers the rest of the way to the operational orbit.', "Apparatning o'z dvigateli operatsion orbitagacha qolgan yo'lni bosib o'tadi."),
      L('A launch site flies a corridor of inclinations; the lowest is its latitude. An orbit outside the corridor costs a plane change, and more than 20° (a game threshold) is treated as unreachable. Geostationary transfers always change plane at apogee, so no threshold applies.', "Uchirish joyi og'ishlar yo'lagi bo'ylab uchadi; eng pastki chegara uning kengligi. Yo'lakdan tashqaridagi orbita tekislik o'zgartirishni talab qiladi, 20° dan ortig'i (o'yin chegarasi) yetib bo'lmas deb hisoblanadi. Geostatsionar o'tishda tekislik doim apogeyda o'zgartiriladi, shuning uchun chegara qo'llanmaydi."),
      L('Which vehicle class flies from which site is a game rule (fictional); latitudes and longitudes are real geographic values.', "Qaysi raketa sinfi qaysi joydan uchishi o'yin qoidasi (xayoliy); kenglik va uzunliklar haqiqiy geografik qiymatlar."),
    ],
    limitations: [
      L('Launch window, fairing size, payload adapter and the speed gained from Earth\'s rotation are not modelled; capacities are quoted for a reference orbit and do not change with the site or inclination.', "Uchirish oynasi, qalpoq o'lchami, adapter va Yer aylanishidan olinadigan tezlik modellashtirilmaydi; sig'imlar tayanch orbita uchun berilgan va joy yoki og'ishga qarab o'zgarmaydi."),
      L('For escape trajectories (Moon, Mars, heliocentric) the site\'s inclination does not enter the model.', "Qochish traektoriyalari (Oy, Mars, geliosentrik) uchun joyning og'ishi modelga kirmaydi."),
      L('The vehicles are generic classes, not real rockets.', "Raketalar umumiy sinflar, haqiqiy raketalar emas."),
    ],
    references: [SMAD],
  },
  {
    id: 'communications-data',
    phase: 2,
    status: 'implemented',
    implementedIn: 'engine/link.ts, engine/data.ts',
    title: L('Communications and data volume', "Aloqa va ma'lumot hajmi"),
    scope: L(
      'How much data the instruments produce, how much the onboard memory holds, and how much the downlink can send to Earth.',
      "Asboblar qancha ma'lumot hosil qilishi, bort xotirasi qancha sig'dirishi va aloqa kanali Yerga qancha yubora olishi.",
    ),
    equations: [
      'P_r = P_t · G_t · G_r · (λ / (4π · d))²,  G_r = η · (π · D / λ)²',
      'R_max = P_r / (k · T_sys · (Eb/N0)_required · L_margin)',
      'V_generated = Σ(rate_i · duty_i) · t',
      'V_downlinked = R · t_contact',
    ],
    assumptions: [
      L('Free-space loss only, plus one fixed implementation margin; the ground antenna and system noise are fixed typical values.', "Faqat bo'sh fazodagi yo'qotish va bitta qat'iy zaxira; yer antennasi va shovqin harorati tipik qat'iy qiymatlar."),
      L('Contact time per day is a fixed typical value per destination.', "Kunlik aloqa vaqti har bir manzil uchun qat'iy tipik qiymat."),
    ],
    limitations: [
      L('Weather, pointing loss, modulation and coding details are not modelled.', "Ob-havo, yo'naltirish yo'qotishi, modulyatsiya va kodlash tafsilotlari modellashtirilmaydi."),
      L('Relay payloads such as transponders do not use onboard storage or the downlink.', "Transponder kabi uzatuvchi yuklamalar bort xotirasi yoki aloqa kanalidan foydalanmaydi."),
    ],
    references: [SMAD, 'Pratt, Bostian & Allnutt, Satellite Communications'],
  },
  {
    id: 'cost',
    phase: 2,
    status: 'implemented',
    implementedIn: 'engine/cost.ts',
    title: L('Mission cost', "Missiya narxi"),
    scope: L(
      'Adds up the prices of the spacecraft, the launch and the days of operations, and compares the total with the budget.',
      "Apparat, uchirish va ekspluatatsiya kunlari narxini qo'shadi va byudjet bilan solishtiradi.",
    ),
    equations: ['C = C_bus + Σ(n_i · c_i) + C_launch + c_ops · (t_cruise + t_ops)'],
    assumptions: [
      L('All prices are game-balance values in constant dollars, and there is no cost growth or discount.', "Barcha narxlar doimiy dollardagi o'yin muvozanati qiymatlari; narx o'sishi yoki chegirma yo'q."),
    ],
    limitations: [
      L('This is not a cost-estimating relationship; real mission costs differ widely and depend on schedule, heritage and risk.', "Bu narxni baholash munosabati emas; haqiqiy missiya narxlari jadval, tajriba va xavfga qarab keskin farq qiladi."),
      L('Insurance, ground segment build-out and development risk are not included.', "Sug'urta, yer segmenti qurilishi va ishlab chiqish xavfi kiritilmagan."),
    ],
    references: [],
  },
  {
    id: 'transfer-approximation',
    phase: 2,
    status: 'implemented',
    implementedIn: 'engine/deltaV.ts',
    title: L('Transfers to the Moon and Mars (patched conics)', "Oy va Marsga uchish (patched conics)"),
    scope: L(
      'Approximate Δv for reaching the operational orbit from the delivery target, including the plane change for geostationary orbit and capture at the Moon and Mars.',
      "Yetkazish nuqtasidan operatsion orbitagacha taxminiy Δv, jumladan geostatsionar orbita uchun tekislik o'zgartirish va Oy hamda Marsda tutib olish.",
    ),
    equations: [
      'v_inf = √(C3)   (Hohmann Earth–Mars: v_inf = |v_planet − v_transfer|)',
      'Δv_leo/sso = Hohmann(r1, r2) with the plane change merged into the burn at the higher orbit',
      'Δv_capture = √(v_inf² + 2μ / r_p) − √(μ / r_p)   (circular capture at r_p)',
      'Δv_plane = √(v1² + v2² − 2 · v1 · v2 · cos(Δi))',
      'heliocentric, orbit crosses 1 AU: v∞² = v_r² + v_t² + v_E² − 2 · v_t · v_E · cos(i), no insertion burn',
      'heliocentric, orbit wholly inside or outside 1 AU: launcher flies a Hohmann ellipse to the orbit\'s nearer extreme (v∞² = v_d² + v_E² − 2 · v_d · v_E · cos(i)); the spacecraft burns Δv = |v_ellipse − v_orbit| there',
    ],
    assumptions: [
      L('Each body\'s gravity acts alone inside its sphere of influence (patched conics), and the planets are on circular, coplanar orbits.', "Har bir jismning tortishishi o'z ta'sir sferasida yolg'iz ishlaydi (patched conics), sayyoralar aylana va bir tekislikdagi orbitalarda deb olinadi."),
      L('A heliocentric orbit is reached from Earth\'s circular orbit; the spacecraft meets Earth\'s orbit tangentially at the crossing point.', "Geliosentrik orbitaga Yerning aylana orbitasidan chiqiladi; apparat kesishish nuqtasida Yer orbitasiga urinma bo'ylab yetib keladi."),
      L('The delivery C3 values are fixed representative numbers.', "Yetkazish C3 qiymatlari qat'iy vakillik qiymatlari."),
    ],
    limitations: [
      L('No launch windows, porkchop plots, aerobraking, gravity assists or mid-course corrections beyond a fixed reserve.', "Uchirish oynalari, porkchop grafiklari, aerotormozlash, tortishish yordami yoki qat'iy zaxiradan tashqari yo'l tuzatishlari yo'q."),
      L('Real mission design uses numerical trajectory optimisation; results here are within tens of percent at best.', "Haqiqiy missiya loyihasi sonli traektoriya optimallashtirishdan foydalanadi; bu yerdagi natijalar eng yaxshi holda o'nlab foiz aniqlikda."),
    ],
    references: [CURTIS, VALLADO],
  },
  {
    id: 'scoring',
    phase: 6,
    status: 'planned',
    title: L('Scoring', "Ball tizimi"),
    scope: L(
      'Turns the simulation outcome into a score with an explanation of why the mission succeeded or failed.',
      "Simulyatsiya natijasini missiya nega muvaffaqiyatli yoki muvaffaqiyatsiz bo'lganini tushuntiruvchi ballga aylantiradi.",
    ),
    equations: ['score = Σ(w_k · s_k)   (components s_k in 0–100, fixed weights w_k)'],
    assumptions: [
      L('Components are mission performance, science value, resource efficiency and quality of decisions.', "Tarkibiy qismlar: missiya natijasi, ilmiy qiymat, resurs samaradorligi va qarorlar sifati."),
    ],
    limitations: [
      L('The weights and thresholds are game design, not a measure of real mission value.', "Vaznlar va chegaralar o'yin dizayni, haqiqiy missiya qiymati o'lchovi emas."),
      L('The same design and seed always give the same score.', "Bir xil dizayn va seed har doim bir xil ball beradi."),
    ],
    references: [],
  },
];

export const getModelCard = (id: ModelCardId): ModelCard | undefined => MODEL_CARDS.find((card) => card.id === id);
