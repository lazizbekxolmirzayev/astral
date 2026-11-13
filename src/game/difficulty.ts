/**
 * The three difficulty levels. A level changes how much help the flight gives and what the score rewards; it never
 * changes the physics or the simulation's numbers, so a design flies the same way on every level.
 *
 * - Cadet: the flight is assisted (gravity turn and staging are automatic), the advised angle is shown and the load
 *   limiter is always on, so one wrong key cannot tear the vehicle apart.
 * - Engineer: assisted flight, the advised angle is shown, the limiter is the power station's choice.
 * - Director: the ascent is flown by hand from the pad, nothing advises the angle and the limiter is the power
 *   station's choice. A clean orbit earns a bonus.
 */
export const DIFFICULTIES = ['cadet', 'engineer', 'director'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type DifficultyRules = {
  /** The pilot mode the ascent starts in (`assist` flies the first stage for the person, `manual` leaves everything). */
  mode: 'assist' | 'manual';
  /** Whether the cockpit shows the advised pitch angle. */
  advice: boolean;
  /** Whether the load limiter is always on, whoever sits at the power station. */
  forcedLimiter: boolean;
  /** Bonus points for a mission that is not a failure (partial counts half). */
  bonus: number;
};

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRules> = {
  cadet: { mode: 'assist', advice: true, forcedLimiter: true, bonus: 0 },
  engineer: { mode: 'assist', advice: true, forcedLimiter: false, bonus: 0 },
  director: { mode: 'manual', advice: false, forcedLimiter: false, bonus: 100 },
};

export const DEFAULT_DIFFICULTY: Difficulty = 'engineer';
