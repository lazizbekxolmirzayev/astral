import { z } from 'zod';
import { SavedExperiment } from '@/lib/models/SavedExperiment';
import { scenarioSchema } from '@/lib/schemas/scenario';
import { connectMongo } from '@/lib/server/mongodb';

export const experimentVisibilitySchema = z.enum(['private', 'unlisted', 'public']);
export const experimentDataSchema = scenarioSchema;
export const reportReasonSchema = z.enum(['spam', 'abuse', 'misinformation', 'copyright', 'other']);

const searchEscape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type PublicExperiment = {
  id: string;
  title: string;
  description: string;
  shareToken: string;
  createdAt: string;
};

function toPublicExperiment(record: Record<string, unknown>): PublicExperiment | null {
  if (record.visibility !== 'public' || typeof record.shareToken !== 'string') return null;
  const date = record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt ?? '');
  return {
    id: String(record._id ?? record.id ?? ''),
    title: typeof record.title === 'string' ? record.title : '',
    description: typeof record.description === 'string' ? record.description : '',
    shareToken: record.shareToken,
    createdAt: date,
  };
}

export async function listPublicExperiments(search: string, page: number, pageSize: number) {
  await connectMongo();
  const safePage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100_000) : 1;
  const filter: Record<string, unknown> = { visibility: 'public' };
  const query = search.trim().slice(0, 100);
  if (query) {
    const literalQuery = new RegExp(searchEscape(query), 'i');
    filter.$or = [{ title: literalQuery }, { description: literalQuery }];
  }

  const [records, total] = await Promise.all([
    SavedExperiment.find(filter)
      .select('_id title description visibility shareToken createdAt')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    SavedExperiment.countDocuments(filter),
  ]);
  return {
    items: records.map((record) => toPublicExperiment(record as Record<string, unknown>)).filter((item): item is PublicExperiment => item !== null),
    total,
    page: safePage,
    pageSize,
    pages: Math.ceil(total / pageSize),
  };
}

export async function getShareableExperiment(shareToken: string) {
  if (!/^[a-f0-9]{64}$/.test(shareToken)) return null;
  await connectMongo();
  const record = await SavedExperiment.findOne({
    shareToken,
    visibility: { $in: ['public', 'unlisted'] },
  }).lean();
  if (!record || (record.visibility !== 'public' && record.visibility !== 'unlisted')) return null;

  const scenario = experimentDataSchema.safeParse(record.data);
  if (!scenario.success || record.schemaVersion !== 1) return null;
  return {
    id: String(record._id),
    title: record.title,
    description: record.description,
    visibility: record.visibility,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
    scenario: scenario.data,
  };
}
