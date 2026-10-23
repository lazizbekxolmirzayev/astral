import { AppProviders } from '@/components/ui/AppProviders';
import { CatalogBrowser } from '@/components/catalog/CatalogBrowser';

export default function CatalogPage() {
  return (
    <AppProviders>
      <CatalogBrowser />
    </AppProviders>
  );
}
