import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { AuditLog } from '@/lib/models/AuditLog';
import { connectMongo } from '@/lib/server/mongodb';
import User from '@/models/User';

export type AdminContext = { adminId: string };

/**
 * Admin gate for every admin route. The role is read from the database on each
 * call, never from the session, so demoting an admin takes effect immediately.
 * Returns the admin's id, or a ready-made error response.
 */
export async function requireAdmin(): Promise<AdminContext | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: { code: 'unauthorized' } }, { status: 401 });
  }
  await connectMongo();
  const user = await User.findById(session.user.id).select('role').lean() as { role?: string } | null;
  if (user?.role !== 'admin') {
    return NextResponse.json({ success: false, error: { code: 'forbidden' } }, { status: 403 });
  }
  return { adminId: session.user.id };
}

export function isAdminContext(value: AdminContext | NextResponse): value is AdminContext {
  return !(value instanceof NextResponse);
}

export async function writeAudit(adminId: string, action: string, targetType: string, targetId: string, detail = ''): Promise<void> {
  await AuditLog.create({ actorId: adminId, action, targetType, targetId, detail: detail.slice(0, 500) });
}
