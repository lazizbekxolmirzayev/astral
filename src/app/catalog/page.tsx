import { SiteNav } from '@/components/ui/SiteNav';
import { AppProviders } from '@/components/ui/AppProviders';
import { CatalogBrowser } from '@/components/catalog/CatalogBrowser';

export default function CatalogPage() {
  return (
    <AppProviders>
      <SiteNav />
      <CatalogBrowser />
    </AppProviders>
  );
}
