import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindById: vi.fn(),
  reportFindOneAndUpdate: vi.fn(),
  reportFind: vi.fn(),
  expFindOneAndUpdate: vi.fn(),
  expFind: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/server/mongodb', () => ({ connectMongo: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/User', () => ({ default: { findById: m.userFindById } }));
vi.mock('@/lib/models/ModerationRecord', () => ({ ModerationRecord: { findOneAndUpdate: m.reportFindOneAndUpdate, find: m.reportFind } }));
vi.mock('@/lib/models/SavedExperiment', () => ({ SavedExperiment: { findOneAndUpdate: m.expFindOneAndUpdate, find: m.expFind } }));
vi.mock('@/lib/models/AuditLog', () => ({ AuditLog: { create: m.auditCreate, find: vi.fn() } }));

import { PATCH as resolveReport } from '@/app/api/admin/reports/[id]/route';
import { POST as unpublish } from '@/app/api/admin/experiments/[id]/unpublish/route';
import { GET as listReports } from '@/app/api/admin/reports/route';

const csrf = 'tok';
const headers = { 'content-type': 'application/json', cookie: `nexus_csrf=${csrf}`, 'x-csrf-token': csrf };
const asRole = (role: string | null) => m.userFindById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(role ? { role } : null) }) });

describe('admin API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects anonymous callers with 401', async () => {
    m.auth.mockResolvedValue(null);
    expect((await listReports()).status).toBe(401);
  });

  it('rejects a signed-in non-admin with 403, checking the role in the database', async () => {
    m.auth.mockResolvedValue({ user: { id: 'u1', role: 'admin' } }); // a stale session claim must not matter
    asRole('user');
    const response = await unpublish(new Request('http://x/api/admin/experiments/e1/unpublish', { method: 'POST', headers }), { params: Promise.resolve({ id: 'e1' }) } as never);
    expect(response.status).toBe(403);
    expect(m.expFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('requires a CSRF token on mutations', async () => {
    m.auth.mockResolvedValue({ user: { id: 'a1' } });
    asRole('admin');
    const response = await unpublish(new Request('http://x/api/admin/experiments/e1/unpublish', { method: 'POST' }), { params: Promise.resolve({ id: 'e1' }) } as never);
    expect(response.status).toBe(403);
  });

  it('unpublishes as admin: private, token revoked, audit written', async () => {
    m.auth.mockResolvedValue({ user: { id: 'a1' } });
    asRole('admin');
    m.expFindOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve({ _id: 'e1' }) });
    const response = await unpublish(new Request('http://x/api/admin/experiments/e1/unpublish', { method: 'POST', headers }), { params: Promise.resolve({ id: 'e1' }) } as never);
    expect(response.status).toBe(200);
    expect(m.expFindOneAndUpdate.mock.calls[0]?.[1]).toEqual({ $set: { visibility: 'private' }, $unset: { shareToken: '' } });
    expect(m.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'a1', action: 'experiment.unpublish', targetId: 'e1' }));
  });

  it('validates the report status and audits the resolution', async () => {
    m.auth.mockResolvedValue({ user: { id: 'a1' } });
    asRole('admin');
    const bad = await resolveReport(new Request('http://x', { method: 'PATCH', headers, body: JSON.stringify({ status: 'pending' }) }), { params: Promise.resolve({ id: 'r1' }) } as never);
    expect(bad.status).toBe(400);
    m.reportFindOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve({ _id: 'r1' }) });
    const ok = await resolveReport(new Request('http://x', { method: 'PATCH', headers, body: JSON.stringify({ status: 'dismissed' }) }), { params: Promise.resolve({ id: 'r1' }) } as never);
    expect(ok.status).toBe(200);
    expect(m.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'report.dismissed', targetId: 'r1' }));
  });
});
