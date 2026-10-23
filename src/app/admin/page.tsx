import { AppProviders } from '@/components/ui/AppProviders';
import { AdminPanel } from '@/components/admin/AdminPanel';

export default function AdminPage() {
  return (
    <AppProviders>
      <AdminPanel />
    </AppProviders>
  );
}
