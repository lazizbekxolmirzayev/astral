'use client';

import { ArrowLeft, Download, FileUp, Save, Share2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/client/api';
import { solarSystem } from '@/data/solarSystem';
import { serializeScenarioAsUsd } from '@/lib/usdExport';
import {
  deleteScenario,
  importScenarioFile,
  listScenarios,
  loadScenario,
  saveScenario,
  ScenarioError,
  serializeScenario,
  type SavedScenario,
} from '@/lib/scenarios';

function filenameFor(name: string) {
  const safeName = name.trim().replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '');
  return `${safeName || 'scenario'}.json`;
}

export function SavedExperiments() {
  const t = useTranslations('saved');
  const shareT = useTranslations('sharing');
  const locale = useLocale();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<SavedScenario[]>([]);
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState<SavedScenario | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sharingScenario, setSharingScenario] = useState<SavedScenario | null>(null);
  const [shareTitle, setShareTitle] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [shareVisibility, setShareVisibility] = useState<'private' | 'unlisted' | 'public'>('unlisted');
  const [shareUrl, setShareUrl] = useState('');

  const messageFor = useCallback((caught: unknown) => {
    if (caught instanceof ScenarioError) {
      const fields = caught.fields.join(', ');
      return caught.code === 'invalidScenario' && fields
        ? t(caught.code, { fields })
        : t(caught.code);
    }
    return t('unexpectedError');
  }, [t]);

  const refresh = useCallback(async () => {
    setItems(await listScenarios());
  }, []);

  useEffect(() => {
    let active = true;
    void listScenarios()
      .then((scenarios) => { if (active) setItems(scenarios); })
      .catch((caught: unknown) => { if (active) setError(messageFor(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [messageFor]);

  async function handleSave() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const saved = await saveScenario(name, solarSystem);
      setName('');
      setItems((current) => [saved, ...current]);
      setNotice(t('savedNotice', { name: saved.name }));
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleLoad(id: string) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const scenario = await loadScenario(id);
      if (!scenario) {
        setError(t('missingScenario'));
        await refresh();
        return;
      }
      setLoaded(scenario);
      setNotice(t('loadedNotice', { name: scenario.name }));
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(scenario: SavedScenario) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await deleteScenario(scenario.id);
      setItems((current) => current.filter((item) => item.id !== scenario.id));
      if (loaded?.id === scenario.id) setLoaded(null);
      setNotice(t('deletedNotice', { name: scenario.name }));
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }

  function handleExport(scenario: SavedScenario) {
    setError('');
    try {
      const blob = new Blob([serializeScenario(scenario)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filenameFor(scenario.name);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  function handleUsdExport(scenario: SavedScenario) {
    setError('');
    try {
      const blob = new Blob([serializeScenarioAsUsd(scenario.name, scenario.objects)], { type: 'model/vnd.usd+text' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filenameFor(scenario.name).replace(/\.json$/u, '.usda');
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  function openShare(scenario: SavedScenario) {
    setSharingScenario(scenario);
    setShareTitle(scenario.name);
    setShareDescription('');
    setShareVisibility('unlisted');
    setShareUrl('');
    setError('');
    setNotice('');
  }

  async function handleCreateShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sharingScenario) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch('/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          title: shareTitle,
          description: shareDescription,
          schemaVersion: 1,
          data: { schemaVersion: 1, name: sharingScenario.name, objects: sharingScenario.objects },
          visibility: shareVisibility,
        }),
      });
      const result = await response.json() as { success?: boolean; data?: { shareToken?: string }; error?: { code?: string } };
      if (response.status === 401) {
        setError(shareT('loginRequired'));
      } else if (!response.ok || !result.success) {
        setError(shareT('shareFailed'));
      } else if (result.data?.shareToken) {
        setShareUrl(`${window.location.origin}/e/${result.data.shareToken}`);
        setNotice('');
      } else {
        setNotice(shareT('privateSaved'));
      }
    } catch {
      setError(shareT('shareFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const imported = await importScenarioFile(await file.text());
      setItems((current) => [imported, ...current]);
      setNotice(t('importedNotice', { name: imported.name }));
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 px-5 py-8 sm:px-8">
      <header className="relative overflow-hidden rounded-[30px] border border-panel-border bg-[radial-gradient(circle_at_top_left,_rgba(0,240,255,0.18),transparent_22%),linear-gradient(135deg,rgba(14,19,30,0.96),rgba(9,12,18,0.9))] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.04)_28%,transparent_58%)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="mb-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-foreground/60 hover:text-accent-cyan">
              <ArrowLeft size={14} aria-hidden />
              {t('back')}
            </Link>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent-cyan">Mission archive</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="mt-1 text-sm text-foreground/60">{t('subtitle')}</p>
          </div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-cyan-200">
            {items.length} saved
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[24px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.95),rgba(8,11,18,0.82))] p-4 sm:p-5">
          <h2 className="text-sm font-semibold">{t('saveTitle')}</h2>
          <p className="mt-1 text-xs text-foreground/55">{t('saveDescription')}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="scenario-name">{t('nameLabel')}</label>
            <input
              id="scenario-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={80}
              className="min-w-0 flex-1 rounded-full border border-panel-border bg-background/60 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/35 outline-none transition focus:border-accent-cyan/60"
            />
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void handleSave()}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-cyan/40 bg-accent-cyan/12 px-4 py-2.5 text-sm text-accent-cyan transition hover:bg-accent-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={15} aria-hidden />
              {t('saveAction')}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-panel-border bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.08),transparent_30%),linear-gradient(180deg,rgba(12,17,27,0.95),rgba(8,11,18,0.8))] p-4 sm:p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/50">Status</p>
          <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-panel-border bg-white/[0.02] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">Scenarios</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{items.length}</div>
            </div>
            <div className="rounded-2xl border border-panel-border bg-white/[0.02] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">Loaded</div>
              <div className="mt-1 text-xl font-semibold text-accent-cyan">{loaded ? loaded.name : '—'}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.95),rgba(8,11,18,0.82))] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{t('listTitle')}</h2>
            <p className="mt-1 text-xs text-foreground/50">{t('listDescription')}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => void handleImport(event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-panel-border bg-white/[0.02] px-3 py-2 text-xs text-foreground/75 transition hover:border-accent-cyan/40 hover:text-accent-cyan disabled:opacity-40"
            >
              <FileUp size={14} aria-hidden />
              {t('importAction')}
            </button>
          </div>
        </div>

        {loading ? <p className="py-8 text-center text-sm text-foreground/45">{t('loading')}</p> : null}
        {!loading && items.length === 0 ? <p className="py-8 text-center text-sm text-foreground/45">{t('empty')}</p> : null}
        {items.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {items.map((scenario) => (
              <li key={scenario.id} className="flex flex-col gap-3 rounded-[18px] border border-panel-border bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-foreground">{scenario.name}</h3>
                  <p className="mt-1 text-xs text-foreground/45">
                    {t('scenarioMeta', {
                      count: scenario.objects.length,
                      date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(scenario.createdAt)),
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void handleLoad(scenario.id)} className="rounded-full border border-panel-border bg-white/[0.02] px-3 py-1.5 text-xs text-foreground transition hover:border-accent-cyan/50 hover:text-accent-cyan disabled:opacity-40">{t('loadAction')}</button>
                  <button type="button" disabled={busy} onClick={() => openShare(scenario)} className="inline-flex items-center gap-1 rounded-full border border-panel-border bg-white/[0.02] px-2.5 py-1.5 text-xs text-foreground transition hover:border-accent-cyan/50 hover:text-accent-cyan disabled:opacity-40"><Share2 size={13} aria-hidden />{shareT('shareAction')}</button>
                  <button type="button" disabled={busy} onClick={() => handleExport(scenario)} aria-label={t('exportLabel', { name: scenario.name })} title={t('exportAction')} className="rounded-full border border-panel-border bg-white/[0.02] p-1.5 text-foreground/65 transition hover:border-accent-cyan/50 hover:text-accent-cyan disabled:opacity-40"><Download size={14} aria-hidden /></button>
                  <button type="button" disabled={busy} onClick={() => handleUsdExport(scenario)} aria-label={t('exportUsdLabel', { name: scenario.name })} title={t('exportUsdAction')} className="rounded-full border border-panel-border bg-white/[0.02] px-2 py-1.5 text-[10px] font-medium text-foreground/65 transition hover:border-accent-cyan/50 hover:text-accent-cyan disabled:opacity-40">USD</button>
                  <button type="button" disabled={busy} onClick={() => void handleDelete(scenario)} aria-label={t('deleteLabel', { name: scenario.name })} title={t('deleteAction')} className="rounded-full border border-panel-border bg-white/[0.02] p-1.5 text-foreground/65 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-40"><Trash2 size={14} aria-hidden /></button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {sharingScenario ? (
          <form onSubmit={(event) => void handleCreateShare(event)} className="mt-5 grid gap-3 rounded-[20px] border border-accent-cyan/25 bg-accent-cyan/6 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{shareT('shareTitle')}: {sharingScenario.name}</h3>
              <button type="button" onClick={() => { setSharingScenario(null); setShareUrl(''); }} className="text-xs text-foreground/55 hover:text-foreground">×</button>
            </div>
            <label className="grid gap-1 text-xs text-foreground/65">
              {shareT('shareTitleLabel')}
              <input value={shareTitle} onChange={(event) => setShareTitle(event.target.value)} maxLength={120} required className="rounded-2xl border border-panel-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-cyan/60" />
            </label>
            <label className="grid gap-1 text-xs text-foreground/65">
              {shareT('visibility')}
              <select value={shareVisibility} onChange={(event) => setShareVisibility(event.target.value as typeof shareVisibility)} className="rounded-2xl border border-panel-border bg-background px-3 py-2 text-sm text-foreground">
                <option value="private">{shareT('private')}</option>
                <option value="unlisted">{shareT('unlistedOption')}</option>
                <option value="public">{shareT('publicOption')}</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-foreground/65">
              {shareT('description')}
              <textarea value={shareDescription} onChange={(event) => setShareDescription(event.target.value)} maxLength={1000} rows={3} className="resize-y rounded-2xl border border-panel-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-cyan/60" />
            </label>
            <button disabled={busy || !shareTitle.trim()} className="justify-self-start rounded-full bg-accent-cyan/15 px-4 py-2 text-xs text-accent-cyan transition hover:bg-accent-cyan/25 disabled:opacity-40">{shareT('createShare')}</button>
            {shareUrl ? <p className="break-all text-xs text-accent-cyan">{shareT('shareLink')}: {shareUrl}</p> : null}
          </form>
        ) : null}
      </section>

      {loaded ? (
        <section className="rounded-[24px] border border-accent-cyan/25 bg-accent-cyan/6 p-4 sm:p-5">
          <h2 className="text-sm font-semibold">{t('loadedTitle', { name: loaded.name })}</h2>
          <p className="mt-1 text-xs text-foreground/55">{t('loadedDescription')}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {loaded.objects.map((object) => (
              <li key={object.id} className="rounded-2xl border border-panel-border/70 bg-white/[0.02] px-3 py-2 text-xs">
                <span className="font-medium">{object.name}</span>
                <span className="ml-2 text-foreground/45">{object.type}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="min-h-6 text-sm" aria-live="polite">
        {error ? <p role="alert" className="text-red-300">{error}</p> : null}
        {!error && notice ? <p className="text-accent-cyan">{notice}</p> : null}
      </div>
    </main>
  );
}
