import { SiteNav } from '@/components/ui/SiteNav';
import { AppProviders } from '@/components/ui/AppProviders';
import { MissionCenter } from '@/components/mission/MissionCenter';

export default function MissionsPage() {
  return (
    <AppProviders>
      <SiteNav />
      <MissionCenter />
    </AppProviders>
  );
}
