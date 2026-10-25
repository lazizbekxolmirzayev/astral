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
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[30px] border border-panel-border bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.12),transparent_22%),linear-gradient(135deg,rgba(12,17,25,0.96),rgba(9,13,20,0.88))] p-8 shadow-[0_30px_80px_rgba(3,6,12,0.8)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.04)_28%,transparent_55%)]" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-cyan-200">NEXUS • UI</span>
            <span className="inline-flex rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-violet-200">Preview</span>
          </div>

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
                  className="flex items-center gap-3 rounded-2xl border border-panel-border bg-white/[0.02] p-3"
                >
                  <span className={`h-8 w-8 rounded-full ${token.utility}`} />
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
              <div className="rounded-2xl border border-panel-border bg-white/[0.02] p-3">
                <div className="text-sm text-foreground/60">{t("themePreview.sansLabel")}</div>
                <div className="mt-1 text-lg">
                  Sirius A, Kepler-186f — Oort buluti / Облако Оорта
                </div>
              </div>
              <div className="rounded-2xl border border-panel-border bg-white/[0.02] p-3">
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
