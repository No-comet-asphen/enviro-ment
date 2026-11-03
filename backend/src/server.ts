// backend/src/server.ts
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { db, haversineDistanceKm } from "./store.ts";
import { handleCreateReport } from "./services/incident.service.ts";
import { handleClarifyReport } from "./services/clarification.service.ts";
import { runIncidentAnalysis } from "./services/grok.service.ts";
import { searchAndIngestEvidence } from "./services/evidence.service.ts";
import { handleAssessRisk } from "./services/risk.service.ts";
import { runMonitoringJob } from "./services/monitoring.service.ts";
import {
  CreateReportSchema,
  ClarifyReportSchema,
  AnalyzeReportSchema,
  SearchEvidenceSchema,
  AssessRiskSchema,
  SubscribeAlertsSchema,
  UpdateIncidentStatusSchema,
  ClaimResolutionSchema,
  MonitorIncidentsSchema
} from "../../supabase/functions/_shared/schemas.ts";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Standard Response Helper
function sendSuccess(res: Response, data: any, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    error: null,
    request_id: crypto.randomUUID()
  });
}

function sendError(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({
    success: false,
    data: null,
    error: { code, message },
    request_id: crypto.randomUUID()
  });
}

const apiRouter = express.Router();

// Health check
apiRouter.get("/health", (_req, res) => {
  sendSuccess(res, { status: "healthy", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------
// 7.1 Submit a citizen report: POST /create-report
// ---------------------------------------------------------------------
apiRouter.post("/create-report", (req, res) => {
  const parseResult = CreateReportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendError(res, "VALIDATION_ERROR", parseResult.error.errors[0]?.message || "Invalid input");
  }

  const result = handleCreateReport(parseResult.data);
  return sendSuccess(res, result, 201);
});

// ---------------------------------------------------------------------
// 7.2 Ask clarification questions: POST /clarify-report
// ---------------------------------------------------------------------
apiRouter.post("/clarify-report", (req, res) => {
  const parseResult = ClarifyReportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendError(res, "VALIDATION_ERROR", parseResult.error.errors[0]?.message || "Invalid input");
  }

  const result = handleClarifyReport(parseResult.data);
  return sendSuccess(res, result);
});

// ---------------------------------------------------------------------
// 7.3 Analyze a report / incident: POST /analyze-report
// ---------------------------------------------------------------------
apiRouter.post("/analyze-report", async (req, res) => {
  const parseResult = AnalyzeReportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendError(res, "VALIDATION_ERROR", parseResult.error.errors[0]?.message || "Invalid input");
  }

  try {
    const result = await runIncidentAnalysis(
      parseResult.data.incident_id,
      parseResult.data.report_id,
      parseResult.data.refresh
    );
    return sendSuccess(res, {
      analysis_id: result.analysis_id,
      status: result.status
    });
  } catch (err: any) {
    return sendError(res, "ANALYSIS_ERROR", err.message || "Failed to analyze incident", 500);
  }
});

// ---------------------------------------------------------------------
// 7.4 Search evidence: POST /search-evidence
// ---------------------------------------------------------------------
apiRouter.post("/search-evidence", async (req, res) => {
  const parseResult = SearchEvidenceSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendError(res, "VALIDATION_ERROR", parseResult.error.errors[0]?.message || "Invalid input");
  }

  try {
    const tempIncidentId = crypto.randomUUID();
    const results = await searchAndIngestEvidence(tempIncidentId, {
      query: parseResult.data.query,
      category: parseResult.data.category,
      locationName: parseResult.data.location?.name,
      latitude: parseResult.data.location?.latitude,
      longitude: parseResult.data.location?.longitude,
      dateFrom: parseResult.data.date_from,
      dateTo: parseResult.data.date_to,
      sourceTypes: parseResult.data.source_types
    });

    return sendSuccess(res, {
      results: results.map(r => ({
        title: r.title,
        source_name: r.source_name,
        source_type: r.source_type,
        url: r.url,
        published_at: r.published_at,
        retrieved_at: r.retrieved_at,
        excerpt: r.excerpt,
        stance: r.stance,
        reliability: r.reliability
      })),
      next_page: null
    });
  } catch (err: any) {
    return sendError(res, "SEARCH_ERROR", err.message || "Failed to retrieve evidence", 500);
  }
});

// ---------------------------------------------------------------------
// 7.5 List incidents: GET /incidents
// ---------------------------------------------------------------------
apiRouter.get("/incidents", (req, res) => {
  const {
    category,
    status,
    severity,
    latitude,
    longitude,
    radius_km,
    page = "1",
    limit = "20"
  } = req.query as Record<string, string>;

  let items = Array.from(db.incidents.values());

  if (category && category !== "all") {
    items = items.filter(i => i.category.toLowerCase() === category.toLowerCase());
  }

  if (status) {
    items = items.filter(i => i.status.toLowerCase() === status.toLowerCase());
  }

  if (severity) {
    items = items.filter(i => i.severity.toLowerCase() === severity.toLowerCase());
  }

  if (latitude && longitude && radius_km) {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const radius = parseFloat(radius_km);
    if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
      items = items.filter(i => haversineDistanceKm(lat, lon, i.latitude, i.longitude) <= radius);
    }
  }

  // Sort descending by last_updated_at
  items.sort((a, b) => new Date(b.last_updated_at).getTime() - new Date(a.last_updated_at).getTime());

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 20);
  const total = items.length;
  const paginated = items.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  const formatted = paginated.map(i => {
    let reportCount = 0;
    for (const r of db.reports.values()) {
      if (r.incident_id === i.id) reportCount++;
    }
    return {
      id: i.id,
      title: i.title,
      category: i.category,
      status: i.status,
      severity: i.severity,
      evidence_confidence: i.evidence_confidence,
      escalation: i.escalation,
      location_name: i.location_name,
      latitude: i.latitude,
      longitude: i.longitude,
      report_count: reportCount || 1,
      last_updated_at: i.last_updated_at
    };
  });

  return sendSuccess(res, {
    items: formatted,
    page: pageNum,
    limit: limitNum,
    total
  });
});

// ---------------------------------------------------------------------
// 7.6 Get incident detail: GET /incident-detail?id=...
// ---------------------------------------------------------------------
apiRouter.get("/incident-detail", (req, res) => {
  const id = req.query.id as string;
  if (!id) {
    return sendError(res, "VALIDATION_ERROR", "Query parameter 'id' is required");
  }

  const incident = db.incidents.get(id);
  if (!incident) {
    return sendError(res, "NOT_FOUND", `Incident ${id} not found`, 404);
  }

  let reportCount = 0;
  for (const r of db.reports.values()) {
    if (r.incident_id === id) reportCount++;
  }

  const evidenceList: any[] = [];
  for (const ev of db.evidence.values()) {
    if (ev.incident_id === id) evidenceList.push(ev);
  }

  const measurementsList = db.findMeasurements(incident.latitude, incident.longitude, 10);
  const applicableStandards = Array.from(db.standards.values()).filter(s => s.is_active);

  const timelineEvents: any[] = [];
  for (const t of db.timeline.values()) {
    if (t.incident_id === id) timelineEvents.push(t);
  }
  timelineEvents.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return sendSuccess(res, {
    incident: {
      id: incident.id,
      title: incident.title,
      summary: incident.summary,
      category: incident.category,
      status: incident.status,
      severity: incident.severity,
      evidence_confidence: incident.evidence_confidence,
      escalation: incident.escalation,
      location_name: incident.location_name,
      latitude: incident.latitude,
      longitude: incident.longitude,
      first_reported_at: incident.first_reported_at,
      last_updated_at: incident.last_updated_at
    },
    report_count: reportCount || 1,
    evidence: evidenceList,
    measurements: measurementsList,
    applicable_standards: applicableStandards,
    timeline: timelineEvents
  });
});

// ---------------------------------------------------------------------
// 7.7 Get map data: GET /map-data
// ---------------------------------------------------------------------
apiRouter.get("/map-data", (req, res) => {
  const { south, west, north, east, category = "all" } = req.query as Record<string, string>;

  let bbox: { south: number; west: number; north: number; east: number } | undefined;
  if (south && west && north && east) {
    bbox = {
      south: parseFloat(south),
      west: parseFloat(west),
      north: parseFloat(north),
      east: parseFloat(east)
    };
  }

  const features = db.findMapFeatures(bbox, category);
  return sendSuccess(res, { features });
});

// ---------------------------------------------------------------------
// 7.8 Get environmental measurements: GET /environmental-data
// ---------------------------------------------------------------------
apiRouter.get("/environmental-data", (req, res) => {
  const { parameter, latitude, longitude, radius_km } = req.query as Record<string, string>;

  const lat = latitude ? parseFloat(latitude) : undefined;
  const lon = longitude ? parseFloat(longitude) : undefined;
  const radius = radius_km ? parseFloat(radius_km) : undefined;

  const measurements = db.findMeasurements(lat, lon, radius, parameter);
  return sendSuccess(res, { measurements });
});

// ---------------------------------------------------------------------
// 7.9 Assess environmental risk: POST /assess-risk
// ---------------------------------------------------------------------
apiRouter.post("/assess-risk", (req, res) => {
  const parseResult = AssessRiskSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendError(res, "VALIDATION_ERROR", parseResult.error.errors[0]?.message || "Invalid input");
  }

  try {
    const result = handleAssessRisk(parseResult.data.measurement_id, parseResult.data.standard_id);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, "RISK_EVALUATION_ERROR", err.message || "Failed to assess risk", 400);
  }
});

// ---------------------------------------------------------------------
// 7.10 Get incident timeline: GET /incident-timeline?incident_id=...
// ---------------------------------------------------------------------
apiRouter.get("/incident-timeline", (req, res) => {
  const incidentId = req.query.incident_id as string;
  if (!incidentId) {
    return sendError(res, "VALIDATION_ERROR", "Query parameter 'incident_id' is required");
  }

  const events: any[] = [];
  for (const t of db.timeline.values()) {
    if (t.incident_id === incidentId) {
      events.push({
        id: t.id,
        event_type: t.event_type,
        message: t.message,
        created_at: t.created_at
      });
    }
  }

  events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return sendSuccess(res, { events });
});

// ---------------------------------------------------------------------
// 7.11 Subscribe to incident or area alerts: POST /subscribe-alerts
// ---------------------------------------------------------------------
apiRouter.post("/subscribe-alerts", (req, res) => {
  const parseResult = SubscribeAlertsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendError(res, "VALIDATION_ERROR", parseResult.error.errors[0]?.message || "Invalid input");
  }

  const subId = crypto.randomUUID();
  db.subscriptions.set(subId, {
    id: subId,
    user_id: crypto.randomUUID(),
    incident_id: parseResult.data.incident_id || null,
    category: parseResult.data.category || null,
    latitude: parseResult.data.area?.latitude || null,
    longitude: parseResult.data.area?.longitude || null,
    radius_km: parseResult.data.area?.radius_km || null,
    enabled: true,
    created_at: new Date().toISOString()
  });

  return sendSuccess(res, {
    subscription_id: subId,
    enabled: true
  });
});

// ---------------------------------------------------------------------
// 7.12 Update incident status: PATCH /incidents?id=...
// ---------------------------------------------------------------------
apiRouter.patch("/incidents", (req, res) => {
  const id = req.query.id as string;
  if (!id) {
    return sendError(res, "VALIDATION_ERROR", "Query parameter 'id' is required");
  }

  const incident = db.incidents.get(id);
  if (!incident) {
    return sendError(res, "NOT_FOUND", `Incident ${id} not found`, 404);
  }

  const parseResult = UpdateIncidentStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendError(res, "VALIDATION_ERROR", parseResult.error.errors[0]?.message || "Invalid input");
  }

  const prevStatus = incident.status;
  incident.status = parseResult.data.status;
  const now = new Date().toISOString();
  incident.last_updated_at = now;

  if (incident.status === "resolved") {
    incident.resolved_at = now;
  }

  // Add timeline entry
  const timelineId = crypto.randomUUID();
  db.timeline.set(timelineId, {
    id: timelineId,
    incident_id: id,
    event_type: "status_changed",
    message: `Status updated from ${prevStatus} to ${incident.status}: ${parseResult.data.message}`,
    metadata: { previous_status: prevStatus, new_status: incident.status },
    created_at: now
  });

  return sendSuccess(res, {
    incident_id: id,
    status: incident.status,
    updated_at: now
  });
});

// ---------------------------------------------------------------------
// 7.13 Claim an incident is resolved: POST /incidents/claim-resolution
// ---------------------------------------------------------------------
apiRouter.post("/incidents/claim-resolution", (req, res) => {
  const parseResult = ClaimResolutionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendError(res, "VALIDATION_ERROR", parseResult.error.errors[0]?.message || "Invalid input");
  }

  const incident = db.incidents.get(parseResult.data.incident_id);
  if (!incident) {
    return sendError(res, "NOT_FOUND", `Incident ${parseResult.data.incident_id} not found`, 404);
  }

  // Product rule: Do not immediately mark as resolved. Move to 'monitoring'
  const prevStatus = incident.status;
  incident.status = "monitoring";
  incident.last_updated_at = new Date().toISOString();

  const timelineId = crypto.randomUUID();
  db.timeline.set(timelineId, {
    id: timelineId,
    incident_id: incident.id,
    event_type: "resolution_claimed",
    message: `Citizen resolution claim recorded: "${parseResult.data.description}". Status moved to monitoring for independent verification.`,
    metadata: { observed_at: parseResult.data.observed_at, previous_status: prevStatus },
    created_at: new Date().toISOString()
  });

  return sendSuccess(res, {
    resolution_claim_id: crypto.randomUUID(),
    incident_status: incident.status,
    message: "Resolution claim recorded; independent confirmation is pending."
  });
});

// ---------------------------------------------------------------------
// 7.14 Monitoring job: POST /monitor-incidents
// ---------------------------------------------------------------------
apiRouter.post("/monitor-incidents", async (req, res) => {
  const parseResult = MonitorIncidentsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendError(res, "VALIDATION_ERROR", parseResult.error.errors[0]?.message || "Invalid input");
  }

  try {
    const summary = await runMonitoringJob(parseResult.data.incident_ids, parseResult.data.mode);
    return sendSuccess(res, summary);
  } catch (err: any) {
    return sendError(res, "MONITOR_JOB_ERROR", err.message || "Failed to run monitoring job", 500);
  }
});

// Mount router on:
// 1. Root /: e.g. /create-report
// 2. /api/: e.g. /api/create-report
// 3. /functions/v1/: e.g. /functions/v1/create-report
app.use("/", apiRouter);
app.use("/api", apiRouter);
app.use("/functions/v1", apiRouter);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  sendError(res, "INTERNAL_SERVER_ERROR", err.message || "An unexpected error occurred", 500);
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`Environmental Intelligence Platform Backend Active!`);
    console.log(`Listening on http://localhost:${PORT}`);
    console.log(`Endpoints available at:`);
    console.log(` - http://localhost:${PORT}/create-report`);
    console.log(` - http://localhost:${PORT}/api/create-report`);
    console.log(` - http://localhost:${PORT}/functions/v1/create-report`);
    console.log(`=======================================================`);
  });
}

export default app;
