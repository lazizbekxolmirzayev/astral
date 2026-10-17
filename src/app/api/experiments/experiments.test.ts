import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, createMock, findMock, findOneMock, countDocumentsMock, findOneAndUpdateMock, findOneAndDeleteMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  createMock: vi.fn(),
  findMock: vi.fn(),
  findOneMock: vi.fn(),
  countDocumentsMock: vi.fn(),
  findOneAndUpdateMock: vi.fn(),
  findOneAndDeleteMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/models/SavedExperiment', () => ({
  SavedExperiment: {
    create: createMock,
    find: findMock,
    findOne: findOneMock,
    countDocuments: countDocumentsMock,
    findOneAndUpdate: findOneAndUpdateMock,
    findOneAndDelete: findOneAndDeleteMock,
  },
}));
vi.mock('@/lib/server/mongodb', () => ({ connectMongo: vi.fn().mockResolvedValue(undefined) }));

import { POST as createExperiment } from '@/app/api/experiments/route';
import { GET as listMine } from '@/app/api/experiments/mine/route';
import { GET as getExperiment, PATCH as updateExperiment, DELETE as deleteExperiment } from '@/app/api/experiments/[id]/route';
import { getShareableExperiment, listPublicExperiments } from '@/lib/server/experiment-sharing';

const validScenario = {
  schemaVersion: 1,
  name: 'Solar test',
  objects: [{ id: 'sun', name: 'Sun', type: 'star', parentId: null }],
};

describe('public experiment sharing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proves private and unlisted experiments never leak into the public gallery', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: 'public-id', visibility: 'public', title: 'Public', description: '', shareToken: 'a'.repeat(64), createdAt: new Date() },
        { _id: 'private-id', visibility: 'private', title: 'Secret', description: 'must not leak', shareToken: undefined, createdAt: new Date() },
        { _id: 'unlisted-id', visibility: 'unlisted', title: 'Link only', description: 'must not list', shareToken: 'b'.repeat(64), createdAt: new Date() },
      ]),
    };
    findMock.mockReturnValue(query);
    countDocumentsMock.mockResolvedValue(1);

    const result = await listPublicExperiments('', 1, 12);

    expect(findMock).toHaveBeenCalledWith({ visibility: 'public' });
    expect(result.items.map((item) => item.title)).toEqual(['Public']);
    expect(JSON.stringify(result)).not.toContain('must not leak');
    expect(JSON.stringify(result)).not.toContain('Secret');
  });

  it('resolves unlisted experiments only by their token and rejects private tokens', async () => {
    const token = 'c'.repeat(64);
    const leanMock = vi.fn().mockResolvedValueOnce({
      _id: 'private-id', visibility: 'private', shareToken: token, schemaVersion: 1, data: validScenario,
    }).mockResolvedValueOnce({
      _id: 'unlisted-id', visibility: 'unlisted', shareToken: token, schemaVersion: 1,
      title: 'Link only', description: '', createdAt: new Date(), data: validScenario,
    });
    findOneMock.mockReturnValue({ lean: leanMock });

    expect(await getShareableExperiment(token)).toBeNull();
    const shared = await getShareableExperiment(token);

    expect(findOneMock).toHaveBeenNthCalledWith(1, {
      shareToken: token,
      visibility: { $in: ['public', 'unlisted'] },
    });
    expect(shared?.visibility).toBe('unlisted');
    expect(shared?.scenario).toEqual(validScenario);
  });
});

describe('SavedExperiment API authorization and validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-a' } });
  });

  it('creates a private experiment from the server session user', async () => {
    const csrf = 'test-csrf-token';
    createMock.mockResolvedValue({
      toObject: () => ({
        _id: 'exp-1',
        owner: 'user-a',
        title: 'Test title',
        description: 'Example',
        schemaVersion: 1,
        data: { schemaVersion: 1, name: 'Solar test', objects: [] },
        visibility: 'private',
        shareToken: 'token-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });

    const response = await createExperiment(new Request('http://localhost/api/experiments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `nexus_csrf=${csrf}`, 'x-csrf-token': csrf },
      body: JSON.stringify({
        title: 'Test title',
        description: 'Example',
        schemaVersion: 1,
        data: { schemaVersion: 1, name: 'Solar test', objects: [] },
        visibility: 'private',
      }),
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.owner).toBe('user-a');
  });

  it('lists only the current user experiments and rejects $-operator filters', async () => {
    const query = { sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([{ _id: 'exp-1', owner: 'user-a', title: 'Mine', visibility: 'private', data: validScenario, schemaVersion: 1 }]) };
    findMock.mockReturnValue(query);

    const goodResponse = await listMine(new Request('http://localhost/api/experiments/mine', {
      headers: { cookie: 'session=user-a' },
    }));
    expect(goodResponse.status).toBe(200);

    const badResponse = await listMine(new Request('http://localhost/api/experiments/mine?filter=%7B%22%24ne%22%3A%22bad%22%7D', {
      headers: { cookie: 'session=user-a' },
    }));
    expect(badResponse.status).toBe(400);
    const badBody = await badResponse.json();
    expect(badBody.error.code).toBe('invalid_filter');
  });

  it('denies user A reading user B private experiment', async () => {
    findOneMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: 'exp-2', owner: 'user-b', title: 'Private', visibility: 'private', description: 'secret', schemaVersion: 1, data: validScenario,
      }),
    });

    const response = await getExperiment(new Request('http://localhost/api/experiments/exp-2'), { params: Promise.resolve({ id: 'exp-2' }) });
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error.code).toBe('forbidden');
  });

  it('denies user A editing user B private experiment', async () => {
    const csrf = 'test-csrf-token';
    findOneMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: 'exp-2', owner: 'user-b', title: 'Private', visibility: 'private', description: 'secret', schemaVersion: 1, data: validScenario,
      }),
    });
    findOneAndUpdateMock.mockResolvedValue({ _id: 'exp-2', owner: 'user-b' });

    const response = await updateExperiment(new Request('http://localhost/api/experiments/exp-2', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: `nexus_csrf=${csrf}`, 'x-csrf-token': csrf },
      body: JSON.stringify({ title: 'Hacked', schemaVersion: 1, data: validScenario, visibility: 'private' }),
    }), { params: Promise.resolve({ id: 'exp-2' }) });
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error.code).toBe('forbidden');
  });

  it('denies user A deleting user B private experiment', async () => {
    const csrf = 'test-csrf-token';
    findOneMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: 'exp-2', owner: 'user-b', title: 'Private', visibility: 'private', description: 'secret', schemaVersion: 1, data: validScenario,
      }),
    });
    findOneAndDeleteMock.mockResolvedValue({ _id: 'exp-2', owner: 'user-b' });

    const response = await deleteExperiment(new Request('http://localhost/api/experiments/exp-2', { method: 'DELETE', headers: { cookie: `nexus_csrf=${csrf}`, 'x-csrf-token': csrf } }), { params: Promise.resolve({ id: 'exp-2' }) });
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error.code).toBe('forbidden');
  });
});
