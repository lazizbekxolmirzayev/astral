import { NextResponse } from 'next/server';
import { AuditLog } from '@/lib/models/AuditLog';
import { isAdminContext, requireAdmin } from '@/lib/server/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminContext(admin)) return admin;
  const entries = await AuditLog.find({}).sort({ createdAt: -1 }).limit(100).lean() as Array<Record<string, unknown>>;
  return NextResponse.json({
    success: true,
    data: entries.map((entry) => ({
      id: String(entry._id),
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : String(entry.createdAt ?? ''),
    })),
  });
}
