import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Stepper } from './import/common';
import { getImport, type ImportSession } from './import/importApi';
import { UploadStep } from './import/UploadStep';
import { MappingStep } from './import/MappingStep';
import { ValueMapStep } from './import/ValueMapStep';
import { ValidationStep } from './import/ValidationStep';
import { HierarchyStep } from './import/HierarchyStep';
import { DedupeStep } from './import/DedupeStep';
import { CommitStep, DryRunStep } from './import/CommitSteps';

/**
 * Import wizard (route /assets/import) — PRD-asset-register-import §4.1, Sprint-1
 * create-only path. The session id and step live in the URL, so the wizard survives
 * refresh and is resumable (?session=<id>&step=<n>, AC9). Forward movement happens
 * only through each step's primary action; the stepper navigates back.
 */
export function AssetImportPage() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('session');
  const stepParam = Number(params.get('step') ?? '0') || 0;

  const sessionQ = useQuery({
    queryKey: ['import-session', sessionId],
    queryFn: async () => (await getImport(sessionId as string)).session,
    enabled: !!sessionId,
    refetchInterval: (q) => (q.state.data?.status === 'committing' ? 2000 : false),
  });
  const session = sessionQ.data ?? null;

  const go = (step: number, id: string | null = sessionId) => {
    const next = new URLSearchParams();
    if (id) { next.set('session', id); next.set('step', String(step)); }
    setParams(next);
  };

  const locked = session != null && ['committing', 'committed', 'undone'].includes(session.status);
  // step 0 = session referenced in the URL but not loaded yet (or failed) — render no step.
  const step = !sessionId ? 1
    : !session ? 0
      : locked ? 8
        : Math.min(Math.max(stepParam || resumeStepFor(session), 2), maxStepFor(session));

  return (
    <>
      <div className="page-head">
        <div>
          <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
            <Link to="/assets">Estate &amp; Assets</Link> <span aria-hidden>/</span> Import
          </nav>
          <div className="page-title">Import asset register</div>
          <div className="page-sub">
            Upload what you have — the wizard turns any contractor spreadsheet into a clean, audited register.
            Nothing touches the live register until Commit.
          </div>
        </div>
        {session?.files[0] && (
          <div className="muted" style={{ fontSize: 12.5, textAlign: 'right' }}>
            <div><strong style={{ fontFamily: 'var(--f-ui)' }}>{session.files[0].filename}</strong></div>
            <div className="tnum">{session.stats?.rows ?? '—'} rows</div>
          </div>
        )}
      </div>

      {step > 0 && (
        <Stepper
          current={step}
          maxReached={step}
          locked={locked}
          onGo={(s) => (s === 1 ? go(1, null) : go(s))}
        />
      )}

      {sessionId && sessionQ.isLoading && (
        <div className="panel"><div className="panel-body muted" style={{ fontSize: 13 }}>Resuming import session…</div></div>
      )}
      {sessionId && sessionQ.isError && (
        <div className="panel"><div className="panel-body">
          <div className="banner err" style={{ marginTop: 0 }}>Couldn’t load this import session — it may not exist for this tenant.</div>
          <p style={{ fontSize: 13, marginTop: 10 }}><button type="button" onClick={() => go(1, null)} style={{ textDecoration: 'underline', color: 'var(--info)', font: 'inherit' }}>Start a new import</button></p>
        </div></div>
      )}

      {step === 1 && (
        <UploadStep
          onCreated={(id) => go(2, id)}
          onResume={(id) => setParams(new URLSearchParams({ session: id }))} // no step → resume at the server-derived stage
        />
      )}
      {session && step === 2 && <MappingStep session={session} onBack={() => go(1, null)} onContinue={() => go(3)} />}
      {session && step === 3 && <ValueMapStep session={session} onBack={() => go(2)} onContinue={() => go(4)} />}
      {session && step === 4 && <ValidationStep session={session} onBack={() => go(3)} onContinue={() => go(5)} />}
      {session && step === 5 && <HierarchyStep session={session} onBack={() => go(4)} onContinue={() => go(6)} />}
      {session && step === 6 && <DedupeStep session={session} onBack={() => go(5)} onContinue={() => go(7)} />}
      {session && step === 7 && <DryRunStep session={session} onBack={() => go(6)} onContinue={() => go(8)} />}
      {session && step === 8 && <CommitStep session={session} onBack={() => go(7)} onRestart={() => go(1, null)} />}
    </>
  );
}

/** Where a reloaded session resumes (server status → wizard step). */
function resumeStepFor(session: ImportSession | null): number {
  switch (session?.status) {
    case 'mapping': return 2;
    case 'validating': return 4;
    case 'hierarchy': return 5;
    case 'dedupe': return 6;
    case 'dry_run': return 7;
    default: return 2;
  }
}

/** Furthest step the URL may address for this session (forward jumps are clamped). */
function maxStepFor(session: ImportSession): number {
  switch (session.status) {
    case 'mapping': return 4; // values + validation are reachable; validation gates onward travel
    case 'validating': {
      const c = session.rowCounts;
      const clean = (c.pending ?? 0) === 0 && (c.error ?? 0) === 0;
      return clean ? 5 : 4;
    }
    case 'hierarchy': return 6;
    case 'dedupe': return 7;
    case 'dry_run': return 8;
    default: return 8;
  }
}
