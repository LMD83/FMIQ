"use client";

/**
 * Dashboard — the project list (reactive) + a minimal "New project" form.
 * Sign-in-less v0: createUser once (stub) + createProject, then the project's
 * page runs the sample review and streams findings. Clerk + R2 upload land next.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function Dashboard() {
  const projects = useQuery(api.projectData.listProjects);
  const createUser = useMutation(api.mutations.createUser);
  const createProject = useMutation(api.mutations.createProject);

  const [name, setName] = useState("");
  const [buildingType, setBuildingType] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      // v0 stub identity — replaced by Clerk later.
      const userId = await createUser({ email: "demo@verifiq.ie", name: "Demo" });
      await createProject({
        owner_user_id: userId,
        name: name.trim(),
        building_type: buildingType.trim() || undefined,
        stage: "pre-tender",
      });
      setName("");
      setBuildingType("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="eyebrow">— Projects</span>
      <h1 className="page-title">The register desk</h1>
      <p className="lede">Create a project, run a read, watch the findings come in.</p>

      <form className="np-form" onSubmit={onCreate}>
        <div>
          <label htmlFor="np-name">Project name</label>
          <input
            id="np-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Adult Day Service — Stage 2C tender"
          />
        </div>
        <div>
          <label htmlFor="np-type">Building type (optional)</label>
          <input
            id="np-type"
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value)}
            placeholder="e.g. Adult Day Service"
          />
        </div>
        <button className="btn" type="submit" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create project →"}
        </button>
      </form>

      {projects === undefined ? (
        <p className="empty">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="empty">No projects yet — create one above to begin.</p>
      ) : (
        <div className="proj-list">
          {projects.map((p) => (
            <a key={p._id} className="proj-row" href={`/projects/${p._id}`}>
              <span className="name">{p.name}</span>
              <span className="meta">
                {p.building_type ? `${p.building_type} · ` : ""}
                {p.scan_state}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
