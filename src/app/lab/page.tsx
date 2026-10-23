import { SiteNav } from '@/components/ui/SiteNav';
import { AppProviders } from '@/components/ui/AppProviders';
import { LabIndex } from '@/components/sandbox/LabIndex';

export default function LabPage() {
  return (
    <AppProviders>
      <SiteNav />
      <LabIndex />
    </AppProviders>
  );
}
