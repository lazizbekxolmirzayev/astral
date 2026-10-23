import { SiteNav } from '@/components/ui/SiteNav';
import { AppProviders } from '@/components/ui/AppProviders';
import { Sandbox } from '@/components/sandbox/SandboxWorkspace';

export default function SandboxPage() {
  return (
    <AppProviders>
      <SiteNav />
      <Sandbox />
    </AppProviders>
  );
}
