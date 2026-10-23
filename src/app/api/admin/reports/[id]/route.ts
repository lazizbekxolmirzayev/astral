import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ModerationRecord } from '@/lib/models/ModerationRecord';
import { isAdminContext, requireAdmin, writeAudit } from '@/lib/server/admin';
import { validateCsrf } from '@/lib/server/csrf';

const bodySchema = z.object({ status: z.enum(['reviewed', 'dismissed']) }).strict();

/** Resolve a report as reviewed or dismissed. Every change is written to the audit log. */
export async function PATCH(request: Request, context: RouteContext<'/api/admin/reports/[id]'>) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const admin = await requireAdmin();
  if (!isAdminContext(admin)) return admin;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'invalid_input' } }, { status: 400 });

  const { id } = await context.params;
  const report = await ModerationRecord.findOneAndUpdate({ _id: id, status: 'pending' }, { $set: { status: parsed.data.status } }, { new: true }).lean();
  if (!report) return NextResponse.json({ success: false, error: { code: 'not_found' } }, { status: 404 });
  await writeAudit(admin.adminId, `report.${parsed.data.status}`, 'report', id);
  return NextResponse.json({ success: true });
}
