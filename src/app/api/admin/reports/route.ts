import { NextResponse } from 'next/server';
import { ModerationRecord } from '@/lib/models/ModerationRecord';
import { SavedExperiment } from '@/lib/models/SavedExperiment';
import { isAdminContext, requireAdmin } from '@/lib/server/admin';

/** Pending reports with the title and visibility of the reported experiment. */
export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminContext(admin)) return admin;

  const reports = await ModerationRecord.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(100).lean() as Array<Record<string, unknown>>;
  const ids = reports.map((report) => report.experimentId);
  const experiments = await SavedExperiment.find({ _id: { $in: ids } }).select('title visibility').lean() as Array<Record<string, unknown>>;
  const byId = new Map(experiments.map((experiment) => [String(experiment._id), experiment]));

  return NextResponse.json({
    success: true,
    data: reports.map((report) => {
      const experiment = byId.get(String(report.experimentId));
      return {
        id: String(report._id),
        experimentId: String(report.experimentId),
        reason: report.reason,
        createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : String(report.createdAt ?? ''),
        experimentTitle: typeof experiment?.title === 'string' ? experiment.title : null,
        experimentVisibility: typeof experiment?.visibility === 'string' ? experiment.visibility : null,
      };
    }),
  });
}
