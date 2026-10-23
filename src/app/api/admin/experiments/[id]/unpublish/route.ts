import { NextResponse } from 'next/server';
import { SavedExperiment } from '@/lib/models/SavedExperiment';
import { isAdminContext, requireAdmin, writeAudit } from '@/lib/server/admin';
import { validateCsrf } from '@/lib/server/csrf';

/** Take an experiment off public/unlisted access: private again, share link revoked. */
export async function POST(request: Request, context: RouteContext<'/api/admin/experiments/[id]/unpublish'>) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const admin = await requireAdmin();
  if (!isAdminContext(admin)) return admin;

  const { id } = await context.params;
  const experiment = await SavedExperiment.findOneAndUpdate(
    { _id: id },
    { $set: { visibility: 'private' }, $unset: { shareToken: '' } },
    { new: true },
  ).lean();
  if (!experiment) return NextResponse.json({ success: false, error: { code: 'not_found' } }, { status: 404 });
  await writeAudit(admin.adminId, 'experiment.unpublish', 'experiment', id);
  return NextResponse.json({ success: true });
}
