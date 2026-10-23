import { AppProviders } from '@/components/ui/AppProviders';
import { SavedExperiments } from '@/components/ui/SavedExperiments';

export default function SavedPage() {
  return (
    <AppProviders>
      <SavedExperiments />
    </AppProviders>
  );
}
