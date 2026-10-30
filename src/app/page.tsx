import { AppProviders } from '@/components/ui/AppProviders';
import { SiteNav } from '@/components/ui/SiteNav';
import { MissionGame } from '@/components/mission/MissionGame';

export default function MissionPage() {
  return (
    <AppProviders>
      <SiteNav />
      <MissionGame />
    </AppProviders>
  );
}
