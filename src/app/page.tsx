import { AppProviders } from "@/components/ui/AppProviders";
import { GameHome } from "@/components/game/GameHome";

/** The home page is the mission game; the universe explorer lives at /universe. */
export default function Home() {
  return (
    <AppProviders>
      <GameHome />
    </AppProviders>
  );
}
