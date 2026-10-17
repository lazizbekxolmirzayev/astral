import { AppProviders } from '@/components/ui/AppProviders';
import { Sandbox } from '@/components/sandbox/SandboxWorkspace';

export default function SandboxPage() {
  return (
    <AppProviders>
      <Sandbox />
    </AppProviders>
  );
}
