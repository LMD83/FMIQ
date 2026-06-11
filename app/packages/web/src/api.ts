import { msalInstance, apiScope, authEnabled } from './authConfig';

async function authHeader(): Promise<Record<string, string>> {
  if (!authEnabled) return {};
  const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
  if (!account) return {};
  const res = await msalInstance.acquireTokenSilent({ scopes: [apiScope], account });
  return { Authorization: `Bearer ${res.accessToken}` };
}

/** API failure carrying the server's structured error body ({ error, message }) when present. */
export class ApiError extends Error {
  constructor(
    public status: number,
    statusText: string,
    public code?: string,
    public serverMessage?: string,
  ) {
    super(`${status} ${statusText}${serverMessage ? ` — ${serverMessage}` : ''}`);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let code: string | undefined;
    let serverMessage: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      code = body.error;
      serverMessage = body.message ?? (typeof body.error === 'string' ? body.error : undefined);
    } catch { /* non-JSON error body — fall through */ }
    throw new ApiError(res.status, res.statusText, code, serverMessage);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Fetch a non-JSON resource (e.g. the print-ready evidence HTML) with auth headers. */
export async function apiText(path: string, init?: RequestInit): Promise<string> {
  const headers: Record<string, string> = { ...(await authHeader()), ...((init?.headers as Record<string, string>) ?? {}) };
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

export interface Zone {
  id: string; name: string; space_name: string; standard: string | null;
  rh: number | null; temp: number | null; rh_min: number | null; rh_max: number | null;
  status: 'ok' | 'watch' | 'crit'; in_excursion: boolean;
}
export interface WorkOrder {
  id: string; ref: string; title: string; source: string; priority: string; status: string;
  location: string | null; conservation_notes: string | null;
}
export type WorkOrderStatus = 'open' | 'assigned' | 'in_progress' | 'closed';

export interface Asset {
  id: string; code: string; name: string; space_id: string | null; building_id: string | null;
  asset_type: string | null; manufacturer: string | null; model: string | null;
  serial_no: string | null; asset_tag: string | null; uniclass_code: string | null;
  sfg20_ref: string | null; install_date: string | null;
  condition_grade: 'A' | 'B' | 'C' | 'D' | null; criticality: string | null;
  expected_life_years: number | string | null; replacement_cost: number | string | null;
  warranty_expiry: string | null; qr_uid: string | null; parent_asset_id: string | null;
  import_session_id: string | null; source_row: number | null;
  created_at: string; updated_at: string;
}

export interface GateCheckResult { checkId: string; passed: boolean; blockMessage?: string; detail?: string; }
export interface GateEvaluation {
  gateCode: string; mode: 'ALL' | 'ANY'; onBlock: 'HARD' | 'SOFT';
  allPassed: boolean; satisfied: boolean; blocked: boolean;
  results: GateCheckResult[]; blockedBy: GateCheckResult[]; firstBlockMessage?: string;
}

// Asset register (EP-1 + Sprint F1 rewrite — routes/assets.ts)
export type AssetListRow = Asset & { location: string | null; building: string | null; site: string | null };

export interface AssetListFilter {
  q?: string; spaceId?: string; buildingId?: string; siteId?: string;
  assetType?: string; conditionGrade?: string; criticality?: string;
  importSessionId?: string; limit?: number; offset?: number;
}

export const listAssets = (filter: AssetListFilter = {}) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  return api<{ assets: AssetListRow[]; total: number }>(`/api/v1/assets${qs ? `?${qs}` : ''}`);
};

/** Provenance panel on GET /api/v1/assets/:id (null when the asset was not imported). */
export interface AssetProvenance {
  session_id: string; committed_at: string | null; filename: string | null;
  imported_by: string | null; source_row: number | null;
}
export interface AssetAuditEntry {
  id: string; user_id: string | null; action: string;
  before: unknown; after: unknown; at: string;
}
export interface AssetDetail { asset: Asset; provenance: AssetProvenance | null; audit: AssetAuditEntry[] }

export const getAsset = (id: string) => api<AssetDetail>(`/api/v1/assets/${id}`);
/** Write payloads are camelCase (routes/assets.ts zod schemas), unlike the snake_case reads. */
export interface AssetWriteInput {
  code?: string; name?: string; spaceId?: string | null; buildingId?: string | null;
  assetType?: string | null; manufacturer?: string | null; model?: string | null;
  serialNo?: string | null; assetTag?: string | null; uniclassCode?: string | null;
  sfg20Ref?: string | null; installDate?: string | null;
  conditionGrade?: 'A' | 'B' | 'C' | 'D' | null; criticality?: string | null;
  expectedLifeYears?: number | null; replacementCost?: number | null; warrantyExpiry?: string | null;
}
export const createAsset = (body: AssetWriteInput & { code: string; name: string }) =>
  api<{ asset: Asset }>(`/api/v1/assets`, { method: 'POST', body: JSON.stringify(body) });
export const updateAsset = (id: string, body: AssetWriteInput) =>
  api<{ asset: Asset }>(`/api/v1/assets/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// Work-order gate + state machine
export const previewGate = (id: string, gate = 'ssow_readiness') =>
  api<{ gate: GateEvaluation }>(`/api/v1/work-orders/${id}/gates?gate=${gate}`);
export const setWorkOrderStatus = (id: string, status: WorkOrderStatus) =>
  api<{ from: WorkOrderStatus; to: WorkOrderStatus; gate?: GateEvaluation }>(
    `/api/v1/work-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const overrideGate = (id: string, gateCode: string, reason: string) =>
  api<{ overridden: boolean; overriddenChecks: string[] }>(
    `/api/v1/work-orders/${id}/gates/${gateCode}/override`, { method: 'POST', body: JSON.stringify({ reason }) });
export interface AtRiskObject {
  cmsObjectId: string; objectName: string; material: string | null; sensitivity: string;
}
export interface EvalResult {
  breach: boolean; severity?: string; kind?: string; zoneName?: string; workOrderRef?: string;
  atRiskObjects: AtRiskObject[]; alerts: { audience: string; message: string }[];
}
export interface Summary {
  buildings: number; sites: number; zones: number; excursions: number; compliantPct: number;
  openWorkOrders: number; workOrdersToday: number;
  complianceRag: Record<string, number>; workOrdersByStatus: Record<string, number>;
}
export interface Site {
  id: string; name: string; county: string | null; heritage_status: string | null;
  buildings: number; zones: number; active_excursions: number; status: 'ok' | 'crit';
}
export interface Obligation {
  type: string; frequency: string | null; next_due: string | null;
  status_rag: string | null; building: string | null;
}
export interface Project {
  name: string; cwmf_stage: string | null; budget: number | null; spend: number | null;
  status_rag: string | null; spend_pct: number;
}
export interface ReadingSeries {
  zoneId: string; metric: string; hours: number;
  target: { rh_min: number | null; rh_max: number | null } | null;
  series: { ts: string; value: number }[];
}

// Role-dashboard ops summary (S12)
export interface OpsSummary {
  openWorkOrders: number; ppmDue: number; certsExpiringSoon: number;
  activeExcursions: number; committedSpend: number; statutoryPpmCompliancePct: number;
}
export const getOpsSummary = () => api<OpsSummary>('/api/v1/dashboard/ops');

// PPM
export interface PpmSchedule {
  id: string; asset_id: string | null; asset_code: string | null; task: string;
  frequency: string | null; next_due: string | null; classification: string | null;
  statutory_flag: boolean; active: boolean;
}
export const listPpmSchedules = () => api<{ schedules: PpmSchedule[] }>('/api/v1/ppm/schedules');
export const generatePpm = () => api<{ generated: Array<{ ref?: string }> }>('/api/v1/ppm/generate', { method: 'POST' });

// Compliance certificates
export interface CertAlert { id: string; cert_type_code: string; ref: string | null; expiry_date: string; days_until: number; tier: number; }
export interface Certificate {
  id: string; cert_type_code: string; ref: string | null; issuer: string | null;
  issue_date: string | null; expiry_date: string | null; status: string;
}
export const listCertificates = () => api<{ certificates: Certificate[] }>('/api/v1/compliance/certificates');
export const listCertAlerts = () => api<{ alerts: CertAlert[] }>('/api/v1/compliance/alerts');

// Inventory
export interface Part {
  id: string; code: string; name: string; critical: boolean;
  // pg returns numeric columns as strings.
  stock_id: string | null; qty_on_hand: number | string | null; qty_reserved: number | string | null; min_qty: number | string | null;
}
export const listParts = () => api<{ parts: Part[] }>('/api/v1/parts');

// Approvals
export interface Requisition {
  id: string; amount_net: number; category: string | null; status: string;
  current_step: number | null; cost_centre: string | null; created_at: string;
}
export const listRequisitions = () => api<{ requisitions: Requisition[] }>('/api/v1/requisitions');
export const decideRequisition = (id: string, decision: 'approved' | 'rejected', comment?: string) =>
  api<{ requisition: unknown }>(`/api/v1/requisitions/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, comment }) });

// Calendar + notifications
export const listBookings = () => api<{ bookings: Record<string, unknown>[] }>('/api/v1/bookings');
export interface Notification { id: string; subject: string; body: string; priority: string; sent_at: string; read_at: string | null; }
export const listNotifications = () => api<{ notifications: Notification[] }>('/api/v1/notifications');
export const ackNotification = (id: string, actionTaken?: string) =>
  api<{ acknowledged: boolean }>(`/api/v1/notifications/${id}/ack`, { method: 'POST', body: JSON.stringify({ actionTaken }) });

// Documents / O&M management (golden thread)
export interface DocumentItem {
  id: string; title: string; doc_type: string; discipline: string | null; reference: string | null;
  status: string; golden_thread: boolean; version_no: number | null; updated_at: string;
}
export const listDocuments = (params?: { docType?: string; goldenThread?: boolean }) => {
  const q = new URLSearchParams();
  if (params?.docType) q.set('docType', params.docType);
  if (params?.goldenThread !== undefined) q.set('goldenThread', String(params.goldenThread));
  const qs = q.toString();
  return api<{ documents: DocumentItem[] }>(`/api/v1/documents${qs ? `?${qs}` : ''}`);
};
export const goldenThread = (entityType: string, entityId: string) =>
  api<{ documents: DocumentItem[] }>(`/api/v1/golden-thread/${entityType}/${entityId}`);
export const createDocument = (body: { title: string; docType?: string; discipline?: string | null; goldenThread?: boolean; blobUri: string; fileName?: string | null }) =>
  api<{ document: Record<string, unknown> }>(`/api/v1/documents`, { method: 'POST', body: JSON.stringify(body) });
export const listDocumentVersions = (id: string) =>
  api<{ versions: DocumentVersion[] }>(`/api/v1/documents/${id}/versions`);
export interface DocumentVersion { id: string; version_no: number; blob_uri: string; file_name: string | null; is_current: boolean; uploaded_at: string; }

// Help desk — self-service requests, SLA, contractor scorecards
export interface ServiceRequest {
  id: string; channel: string; category: string | null; description: string; priority: string;
  status: string; sla_due: string | null; work_order_id: string | null; created_at: string;
}
export const listRequests = () => api<{ requests: ServiceRequest[] }>('/api/v1/requests');
export const createRequest = (body: { description: string; channel?: string; spaceId?: string | null; assetId?: string | null; requesterName?: string | null }) =>
  api<{ request: Record<string, unknown> }>('/api/v1/requests', { method: 'POST', body: JSON.stringify(body) });
export const convertRequest = (id: string) =>
  api<{ requestId: string; workOrderId: string; ref: string; slaDue: string }>(`/api/v1/requests/${id}/convert`, { method: 'POST' });
export interface ContractorScorecard { jobs: number; closed: number; onTimePct: number; openBreaches: number; }
export const getContractorScorecard = (id: string) =>
  api<{ scorecard: ContractorScorecard }>(`/api/v1/contractors/${id}/scorecard`);

// Evidence packs (one-click audit/HSA/loan bundle)
export const getWorkOrderEvidence = (id: string) =>
  api<{ pack: Record<string, unknown> }>(`/api/v1/evidence/work-order/${id}`);
/** Fetch the print-ready evidence HTML (auth-aware) and open it in a new tab via a blob URL. */
export const openWorkOrderEvidence = async (id: string): Promise<void> => {
  const html = await apiText(`/api/v1/evidence/work-order/${id}.html`);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// --- Contractor compliance vault -----------------------------------------
export interface ContractorVaultRow {
  id: string; name: string; prequal_status: string | null; insurance_expiry: string | null;
  total_docs: number; valid_docs: number; expired_docs: number; unverified_docs: number;
  next_expiry: string | null;
}
export const getContractorVault = () =>
  api<{ contractors: ContractorVaultRow[] }>('/api/v1/ssow/contractor-vault');

// --- QR mobile issue capture ---------------------------------------------
export interface ResolvedAsset {
  assetId: string; code: string; name: string; assetType: string | null;
  spaceId: string | null; location: string | null;
}
export interface CaptureResult {
  workOrderId: string; ref: string; asset: ResolvedAsset; priority: string; photoAttached: boolean;
}
export interface IssueInput {
  qrUid?: string; assetId?: string; description: string;
  priority?: 'routine' | 'high' | 'critical'; reporterName?: string;
  photoUrl?: string; photoCaption?: string;
}
export const resolveAssetByQr = (qrUid: string) =>
  api<{ asset: ResolvedAsset }>(`/api/v1/assets/by-qr/${encodeURIComponent(qrUid)}`);
export const reportIssue = (input: IssueInput) =>
  api<CaptureResult>('/api/v1/issues', { method: 'POST', body: JSON.stringify(input) });
