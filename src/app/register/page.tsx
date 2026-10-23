import { AppProviders } from '@/components/ui/AppProviders';
import { AuthForm } from '@/components/ui/AuthForm';

export default function Page() {
  return (
    <AppProviders>
      <AuthForm mode="register" />
    </AppProviders>
  );
}
