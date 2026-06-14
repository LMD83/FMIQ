"use client";

/**
 * Project page — live status + the findings register. `useQuery` is reactive, so
 * findings stream in as the council runs (no polling). "Run sample review"
 * dispatches the shared sample pack to the engine via requestReview.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { buildSamplePack, ACTIVE_STATES } from "../../_lib/sample-pack";

type Severity = "critical" | "high" | "medium" | "low";

function sevClass(risk: string): string {
  const r = risk.toLowerCase();
  return `sev-${["critical", "high", "medium", "low"].includes(r) ? r : "low"}`;
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as Id<"projects">;

  const status = useQuery(api.projectData.getProjectStatus, { project_id: projectId });
  const findings = useQuery(api.projectData.getProjectFindings, { project_id: projectId });
  const requestReview = useMutation(api.reviewData.requestReview);

  const [busy, setBusy] = useState(false);

  const working = status ? ACTIVE_STATES.has(status.scan_state) : false;

  async function runSample() {
    setBusy(true);
    try {
      const pack = buildSamplePack();
      await requestReview({
        project_id: projectId,
        payload_json: JSON.stringify({ ...pack, projectId }),
      });
    } finally {
      setBusy(false);
    }
  }

  const by = status?.by_severity ?? { critical: 0, high: 0, medium: 0, low: 0 };

  return (
    <div>
      <a className="eyebrow" href="/">
        ← All projects
      </a>
      <h1 className="page-title">{status ? status.name : "Loading…"}</h1>
      <p className="lede">
        {status ? (
          <>
            State:{" "}
            <span className={`state-pill ${working ? "state-working" : "state-done"}`}>
              {status.scan_state}
            </span>
            {working ? " — the council is reading…" : " — read complete."}
          </>
        ) : (
          "Fetching status…"
        )}
      </p>

      <div className="status-band">
        <div className="cell">
          <div className="num">{status?.finding_count ?? "—"}</div>
          <div className="lab">Findings</div>
        </div>
        <div className="cell">
          <div className="num">{by.critical}</div>
          <div className="lab">Critical</div>
        </div>
        <div className="cell">
          <div className="num">{by.high}</div>
          <div className="lab">High</div>
        </div>
        <div className="cell">
          <div className="num">{by.medium}</div>
          <div className="lab">Medium</div>
        </div>
        <div className="cell">
          <div className="num">{by.low}</div>
          <div className="lab">Low</div>
        </div>
      </div>

      <button className="btn" onClick={runSample} disabled={busy || working}>
        {busy ? "Dispatching…" : working ? "Reading…" : "Run sample review →"}
      </button>

      <h2 style={{ margin: "34px 0 16px" }}>Findings register</h2>
      {findings === undefined ? (
        <p className="empty">Loading findings…</p>
      ) : findings.length === 0 ? (
        <p className="empty">
          No findings yet. {working ? "The council is still reading." : "Run a review to populate the register."}
        </p>
      ) : (
        <div>
          {findings.map(
            (f: {
              _id: string;
              risk: string;
              issue_id: string;
              discipline_origin: string;
              requirement: string;
              finding: string;
              source_document: string;
              source_reference: string;
            }) => (
            <div className="finding" key={f._id}>
              <div className="finding-head">
                <span className={`sev solid ${sevClass(String(f.risk))}`}>{String(f.risk)}</span>
                <span className="issue-id">
                  {f.issue_id} · {f.discipline_origin}
                </span>
              </div>
              <p className="req">{f.requirement}</p>
              <p className="body">{f.finding}</p>
              <div className="source-quote">
                {f.source_document}
                <span className="src-ref">{f.source_reference}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
