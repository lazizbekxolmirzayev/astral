import type { Analysis, FlightResult, Insight, RoleGoal, Score } from './types';

const SUCCESS_POINTS = { full: 20, partial: 10, failed: 0 } as const;
const SCIENCE_POINTS = 50;
const SCIENCE_FULL_MARKS = 1.5;
const BUDGET_POINTS = 15;
const BUDGET_FULL_MARKS_PCT = 25;
const ROBUSTNESS_POINTS = 15;
const POWER_FULL_MARKS_PCT = 30;
const MASS_FULL_MARKS_PCT = 20;
const ROLE_BONUS_POINTS = 5;

const GOAL_BUDGET_MARGIN_PCT = 10;
const GOAL_MASS_MARGIN_PCT = 10;
const GOAL_POWER_MARGIN_PCT = 15;
const GOAL_SCIENCE_FACTOR = 1.2;
const GOAL_RETURN_PCT = 80;

const DATA_LOSS_INSIGHT_PCT = 10;
const LOW_DUTY = 0.9;
const COMFORTABLE_POWER_PCT = 25;
const COMFORTABLE_BUDGET_PCT = 15;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Team mode: each role guards one resource, so priorities really do compete. */
export function roleGoals(analysis: Analysis, flight: FlightResult): RoleGoal[] {
  const returnedPct = flight.generatedGb > 0 ? (flight.returnedGb / flight.generatedGb) * 100 : 0;
  const scienceGoal = analysis.science.required * GOAL_SCIENCE_FACTOR;
  return [
    { role: 'director', met: analysis.budget.marginPct >= GOAL_BUDGET_MARGIN_PCT, params: { goal: GOAL_BUDGET_MARGIN_PCT, value: Math.round(analysis.budget.marginPct) } },
    { role: 'engineer', met: analysis.mass.marginPct >= GOAL_MASS_MARGIN_PCT && analysis.power.marginPct >= GOAL_POWER_MARGIN_PCT, params: { massGoal: GOAL_MASS_MARGIN_PCT, powerGoal: GOAL_POWER_MARGIN_PCT, mass: Math.round(analysis.mass.marginPct), power: Math.round(analysis.power.marginPct) } },
    { role: 'scientist', met: flight.scienceValue >= scienceGoal, params: { goal: Math.round(scienceGoal), value: Math.round(flight.scienceValue) } },
    { role: 'operator', met: returnedPct >= GOAL_RETURN_PCT, params: { goal: GOAL_RETURN_PCT, value: Math.round(returnedPct) } },
  ];
}

/** Explains the result in cause and effect, not just right or wrong. */
export function explainFlight(analysis: Analysis, flight: FlightResult): Insight[] {
  const insights: Insight[] = [];
  const add = (id: string, tone: Insight['tone'], params: Insight['params'] = {}) => insights.push({ id, tone, params });

  if (flight.endCause !== 'completed') add(flight.endCause, 'bad', { days: flight.operationsDays, planned: flight.plannedDays });
  if (analysis.science.missingCapabilities.length > 0) add('missingCapability', 'bad', { missing: analysis.science.missingCapabilities.join(', ') });

  const lostPct = flight.generatedGb > 0 ? (flight.lostGb / flight.generatedGb) * 100 : 0;
  if (lostPct >= DATA_LOSS_INSIGHT_PCT) {
    add('dataLost', 'bad', { pct: Math.round(lostPct), generated: Number(analysis.data.generatedGbPerDay.toFixed(1)), downlink: Number(analysis.data.downlinkGbPerDay.toFixed(2)) });
  } else if (flight.operationsDays > 0 && flight.generatedGb > 0) {
    add('dataHealthy', 'good', { pct: Math.round(100 - lostPct) });
  }
  if (flight.operationsDays > 0 && flight.meanDuty < LOW_DUTY) add('lowDuty', 'bad', { pct: Math.round(flight.meanDuty * 100) });
  if (analysis.power.batteryFactor < 1) add('batteryShort', 'bad', { need: Math.round(analysis.power.batteryNeededWh), have: Math.round(analysis.power.batteryUsableWh), eclipse: Math.round(analysis.power.eclipseMinutes) });
  if (analysis.power.marginPct >= COMFORTABLE_POWER_PCT) add('powerMargin', 'good', { pct: Math.round(analysis.power.marginPct) });
  if (analysis.budget.marginPct >= COMFORTABLE_BUDGET_PCT) add('budgetMargin', 'good', { pct: Math.round(analysis.budget.marginPct) });
  if (flight.outcome !== 'full' && flight.scienceValue < analysis.science.required) add('scienceShort', 'bad', { value: Math.round(flight.scienceValue), required: Math.round(analysis.science.required) });
  if (flight.events.some((event) => event.id === 'wheelFailover')) add('redundancyPaid', 'good');
  if (flight.events.some((event) => event.id === 'wheelFailure')) add('noRedundancy', 'info');
  if (analysis.time.windowWaitMonths > 0) add('launchWindow', 'info', { months: Math.round(analysis.time.windowWaitMonths) });
  return insights;
}

export function scoreMission(analysis: Analysis, flight: FlightResult, teamPlay: boolean): Score {
  const success = SUCCESS_POINTS[flight.outcome];
  const science = Math.round(SCIENCE_POINTS * clamp01(flight.scienceValue / (analysis.science.required * SCIENCE_FULL_MARKS)));
  const flew = flight.operationsDays > 0;
  const budget = flew ? Math.round(BUDGET_POINTS * clamp01(analysis.budget.marginPct / BUDGET_FULL_MARKS_PCT)) : 0;
  const robustness = flew
    ? Math.round(ROBUSTNESS_POINTS * (clamp01(analysis.power.marginPct / POWER_FULL_MARKS_PCT) + clamp01(analysis.mass.marginPct / MASS_FULL_MARKS_PCT)) / 2)
    : 0;
  const goals = roleGoals(analysis, flight);
  const teamBonus = teamPlay ? goals.filter((goal) => goal.met).length * ROLE_BONUS_POINTS : 0;
  return {
    total: success + science + budget + robustness + teamBonus,
    success,
    science,
    budget,
    robustness,
    teamBonus,
    goals,
    insights: explainFlight(analysis, flight),
  };
}
