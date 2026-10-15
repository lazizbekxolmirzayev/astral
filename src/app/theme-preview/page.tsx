import { AppProviders } from "@/components/ui/AppProviders";
import { useTranslations } from "next-intl";

const tokens = [
  { name: "background", utility: "bg-background", hex: "#0B0E14" },
  { name: "accent-cyan", utility: "bg-accent-cyan", hex: "#00F0FF" },
  { name: "star-gold", utility: "bg-star-gold", hex: "#F5B041" },
  { name: "nebula-purple", utility: "bg-nebula-purple", hex: "#6C5CE7" },
] as const;

const provenanceKeys = [
  "measured",
  "derived",
  "estimated",
  "fictional",
  "artistic",
] as const;

/** Dev-only page kept from the theme task so tokens and fonts stay checkable. */
function ThemePreviewContent() {
  const t = useTranslations();

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-2xl rounded-lg border border-panel-border bg-panel-border/5 p-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("app.title")} <span className="text-accent-cyan">{t("themePreview.title")}</span>
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          {t("themePreview.subtitle")} — {t("inspector.provenance")}: {t("provenance.artistic")}
        </p>

        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-foreground/60">
            {t("themePreview.colors")}
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {tokens.map((token) => (
              <li
                key={token.name}
                className="flex items-center gap-3 rounded-md border border-panel-border p-3"
              >
                <span className={`h-8 w-8 rounded ${token.utility}`} />
                <span className="flex-1 text-sm">{token.name}</span>
                <span className="font-mono text-sm text-foreground/70">{token.hex}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-foreground/60">
            {t("themePreview.fonts")}
          </h2>
          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-panel-border p-3">
              <div className="text-sm text-foreground/60">{t("themePreview.sansLabel")}</div>
              <div className="mt-1 text-lg">
                Sirius A, Kepler-186f — Oort buluti / Облако Оорта
              </div>
            </div>
            <div className="rounded-md border border-panel-border p-3">
              <div className="text-sm text-foreground/60">{t("themePreview.monoLabel")}</div>
              <div className="mt-1 font-mono text-lg text-star-gold">
                1.496 × 10¹¹ m · 365.256 d · 5 778 K
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-foreground/60">
            {t("themePreview.provenanceLabels")}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {provenanceKeys.map((key, index) => (
              <span
                key={key}
                className={`rounded-full border border-panel-border px-3 py-1 font-mono text-xs ${
                  index === 0
                    ? "text-accent-cyan"
                    : index === provenanceKeys.length - 1
                      ? "text-nebula-purple"
                      : "text-star-gold"
                }`}
              >
                {t(`provenance.${key}`)}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ThemePreviewPage() {
  return (
    <AppProviders>
      <ThemePreviewContent />
    </AppProviders>
  );
}
