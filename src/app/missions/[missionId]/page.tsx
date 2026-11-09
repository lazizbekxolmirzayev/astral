import { Suspense } from 'react';
import { SiteNav } from '@/components/ui/SiteNav';
import { AppProviders } from '@/components/ui/AppProviders';
import { MissionWorkspace } from '@/components/mission/MissionWorkspace';

// `params` is request-time data under Cache Components, so it is awaited inside a
// Suspense boundary: the shell can be prerendered while the mission id is unknown.
export default function MissionPage({ params }: PageProps<'/missions/[missionId]'>) {
  return (
    <Suspense>
      <MissionRoute params={params} />
    </Suspense>
  );
}

async function MissionRoute({ params }: Pick<PageProps<'/missions/[missionId]'>, 'params'>) {
  const { missionId } = await params;
  return (
    <AppProviders>
      <SiteNav />
      <MissionWorkspace missionId={missionId} />
    </AppProviders>
  );
}
