"use client";

/**
 * VerifIQ — direct-upload route (docs/42 §5.2, Sprint 2).
 *
 * The other end of the magic-code handoff: a customer lands here from the
 * emailed link (`/upload?code=…`), the code is verified into a project-scoped
 * upload session, and they drag their pack straight in. Each file is hashed in
 * the browser, uploaded direct to R2 via a signed URL, and registered server
 * side; sealing the pack advances the scan-state into the council pipeline.
 *
 * The session token is held in sessionStorage so a refresh or a dropped
 * connection resumes without re-verifying the (now spent) code (docs/42 A7).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  UPLOAD_DISCIPLINES,
  formatBytes,
  putToSignedUrl,
  sha256OfBlob,
  type UploadDiscipline,
} from "../../storage/upload-client";

const SESSION_KEY = "verifiq_upload_session";

type Phase = "init" | "need-code" | "verifying" | "ready" | "sealed" | "error";

type FileStatus = "pending" | "hashing" | "uploading" | "done" | "error";

interface UploadItem {
  id: string;
  file: File;
  discipline: UploadDiscipline;
  status: FileStatus;
  progress: number;
  error?: string;
}

const ERROR_COPY: Record<string, string> = {
  invalid: "That link or code isn’t valid. Request a fresh one from the site.",
  used: "That link has already been used. Request a fresh one from the site.",
  expired: "That link has expired. Request a fresh one from the site.",
  revoked: "That link has been revoked. Request a fresh one from the site.",
  locked: "Too many attempts. Request a fresh link from the site.",
};

export default function UploadPage() {
  const [phase, setPhase] = useState<Phase>("init");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [discipline, setDiscipline] = useState<UploadDiscipline>("unclassified");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [sealing, setSealing] = useState(false);

  const verify = useMutation(api.uploadTokens.verifyUploadCode);
  const getUploadUrl = useAction(api.uploadDirect.getUploadUrlForSession);
  const registerDoc = useMutation(api.uploadDocs.registerUploadedDocument);
  const seal = useMutation(api.uploadDocs.sealUploadSession);
  const manifest = useQuery(
    api.uploadDocs.listSessionDocuments,
    sessionToken ? { sessionToken } : "skip",
  );

  const doVerify = useCallback(
    async (secret: string) => {
      setPhase("verifying");
      setError(null);
      try {
        const res = await verify({ secret });
        if (res.ok) {
          sessionStorage.setItem(SESSION_KEY, res.sessionToken);
          setSessionToken(res.sessionToken);
          setProjectId(res.projectId);
          setPhase("ready");
        } else {
          setError(ERROR_COPY[res.error] ?? "That link isn’t valid.");
          setPhase("error");
        }
      } catch {
        setError("Something went wrong verifying your link. Please try again.");
        setPhase("error");
      }
    },
    [verify],
  );

  // On mount: resume a stored session, else verify a ?code, else ask for a code.
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      setSessionToken(stored);
      setPhase("ready");
      return;
    }
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) void doVerify(code);
    else setPhase("need-code");
  }, [doVerify]);

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      const patch = (u: Partial<UploadItem>) =>
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, ...u } : it)));
      try {
        patch({ status: "hashing", progress: 0 });
        const sha256 = await sha256OfBlob(item.file);
        patch({ status: "uploading" });
        const signed = await getUploadUrl({
          sessionToken: sessionToken!,
          filename: item.file.name,
          sha256,
          size_bytes: item.file.size,
          discipline: item.discipline,
        });
        if (!signed.ok || !signed.uploadUrl || !signed.key) {
          patch({ status: "error", error: "Couldn’t get an upload slot — your link may have expired." });
          return;
        }
        await putToSignedUrl(signed.uploadUrl, item.file, {
          method: signed.method,
          contentType: item.file.type || "application/octet-stream",
          onProgress: (f) => patch({ progress: f }),
        });
        const reg = await registerDoc({
          sessionToken: sessionToken!,
          filename: item.file.name,
          sha256,
          size_bytes: item.file.size,
          r2_key: signed.key,
          discipline: item.discipline,
        });
        if (!reg.ok) {
          patch({ status: "error", error: "Upload couldn’t be recorded." });
          return;
        }
        patch({ status: "done", progress: 1 });
      } catch {
        patch({ status: "error", error: "Upload failed — you can retry this file." });
      }
    },
    [getUploadUrl, registerDoc, sessionToken],
  );

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || !sessionToken) return;
      const next: UploadItem[] = Array.from(fileList).map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        discipline,
        status: "pending",
        progress: 0,
      }));
      setItems((prev) => [...prev, ...next]);
      // Upload sequentially to keep memory + connections sane on large packs.
      void next.reduce(
        (chain, item) => chain.then(() => uploadOne(item)),
        Promise.resolve(),
      );
    },
    [discipline, sessionToken, uploadOne],
  );

  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const doSeal = useCallback(async () => {
    if (!sessionToken) return;
    setSealing(true);
    try {
      const res = await seal({ sessionToken });
      if (res.ok) {
        if (res.projectId) setProjectId(res.projectId);
        sessionStorage.removeItem(SESSION_KEY);
        setPhase("sealed");
      } else if (res.error === "no_documents") {
        setError("Add at least one file before starting the read.");
      } else {
        setError("Your session has expired. Request a fresh link from the site.");
        setPhase("error");
      }
    } finally {
      setSealing(false);
    }
  }, [seal, sessionToken]);

  const doneCount = items.filter((it) => it.status === "done").length;
  const busy = items.some((it) => it.status === "hashing" || it.status === "uploading");

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "init" || phase === "verifying") {
    return (
      <div>
        <span className="eyebrow">— Secure upload</span>
        <h1 className="page-title">Opening your upload session…</h1>
        <p className="lede">One moment while we verify your link.</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div>
        <span className="eyebrow">— Secure upload</span>
        <h1 className="page-title">We couldn’t open that link</h1>
        <p className="lede">{error}</p>
        <p>
          <a className="btn" href="/first-read.html">
            Request a fresh link →
          </a>
        </p>
      </div>
    );
  }

  if (phase === "sealed") {
    return (
      <div>
        <span className="eyebrow">— Pack received</span>
        <h1 className="page-title">Your pack is in. The read has started.</h1>
        <p className="lede">
          We’re classifying your {doneCount} {doneCount === 1 ? "file" : "files"} and the council is
          beginning its read. You’ll get an email when the register is ready.
        </p>
        {projectId ? (
          <p>
            <a className="btn" href={`/projects/${projectId}`}>
              Follow the read →
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  if (phase === "need-code") {
    return (
      <div>
        <span className="eyebrow">— Secure upload</span>
        <h1 className="page-title">Enter your upload code</h1>
        <p className="lede">
          Open the link in your email, or type the 6-character code we sent you.
        </p>
        <form
          className="np-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (codeInput.trim()) void doVerify(codeInput.trim());
          }}
        >
          <div>
            <label htmlFor="code">Upload code</label>
            <input
              id="code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="e.g. K7M2QP"
              autoComplete="one-time-code"
            />
          </div>
          <button className="btn" type="submit" disabled={!codeInput.trim()}>
            Verify →
          </button>
        </form>
      </div>
    );
  }

  // phase === "ready"
  const serverCount = Array.isArray(manifest) ? manifest.length : 0;
  return (
    <div>
      <span className="eyebrow">— Secure upload</span>
      <h1 className="page-title">Upload your pack</h1>
      <p className="lede">
        Drag your files in — they upload directly and securely, and resume if your connection
        drops. The read starts the moment you’re done.
      </p>

      <div style={{ margin: "16px 0" }}>
        <label htmlFor="disc" style={{ marginRight: 8 }}>
          Tag new files as
        </label>
        <select
          id="disc"
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value as UploadDiscipline)}
        >
          {UPLOAD_DISCIPLINES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div
        className={dragOver ? "dropzone drag" : "dropzone"}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        role="button"
        tabIndex={0}
        style={{
          border: "1.5px dashed currentColor",
          padding: "32px",
          textAlign: "center",
          cursor: "pointer",
          opacity: dragOver ? 1 : 0.85,
        }}
      >
        <p>Drop files here, or click to choose</p>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {items.length > 0 ? (
        <ul className="proj-list" style={{ marginTop: 16 }}>
          {items.map((it) => (
            <li key={it.id} className="proj-row">
              <span className="name">{it.file.name}</span>
              <span className="meta">
                {it.discipline} · {formatBytes(it.file.size)} ·{" "}
                {it.status === "uploading"
                  ? `${Math.round(it.progress * 100)}%`
                  : it.status === "error"
                    ? (it.error ?? "failed")
                    : it.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <button
          className="btn"
          type="button"
          disabled={busy || sealing || doneCount === 0}
          onClick={() => void doSeal()}
        >
          {sealing
            ? "Starting the read…"
            : `I’m done — start the read (${doneCount} uploaded)`}
        </button>
        {serverCount > 0 ? (
          <p className="meta" style={{ marginTop: 8 }}>
            {serverCount} {serverCount === 1 ? "file" : "files"} recorded on the server.
          </p>
        ) : null}
        {error ? <p className="meta">{error}</p> : null}
      </div>
    </div>
  );
}
