import { Shell } from "@/components/ui/Shell";
import { AppProviders } from "@/components/ui/AppProviders";

/** The Solar System explorer (the original home page), kept as its own page. */
export default function UniversePage() {
  return (
    <AppProviders>
      <Shell />
    </AppProviders>
  );
}
