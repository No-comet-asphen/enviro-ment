// supabase/functions/_shared/schemas.ts
import { z } from "zod";

export const CreateReportSchema = z.object({
  description: z.string().min(5, "Description must be at least 5 characters"),
  category: z.string().optional().default("other"),
  title: z.string().optional(),
  location: z.object({
    name: z.string().min(2, "Location name required"),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }),
  observed_at: z.string().datetime().optional().default(() => new Date().toISOString()),
  attachment_ids: z.array(z.string().uuid()).optional().default([])
});

export const ClarifyReportSchema = z.object({
  description: z.string().min(3),
  location: z.object({
    name: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
  }).optional(),
  answers: z.array(
    z.object({
      question_id: z.string(),
      answer: z.union([z.string(), z.array(z.string())])
    })
  ).optional().default([])
});

export const AnalyzeReportSchema = z.object({
  report_id: z.string().uuid().optional(),
  incident_id: z.string().uuid(),
  refresh: z.boolean().optional().default(false)
});

export const SearchEvidenceSchema = z.object({
  query: z.string().min(2),
  category: z.string().optional(),
  location: z.object({
    name: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
  }).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  source_types: z.array(z.enum(["government", "monitoring", "news", "citizen", "research"])).optional()
});

export const AssessRiskSchema = z.object({
  measurement_id: z.string().uuid(),
  standard_id: z.string().uuid()
});

export const SubscribeAlertsSchema = z.object({
  incident_id: z.string().uuid().nullable().optional(),
  category: z.string().nullable().optional(),
  area: z.object({
    latitude: z.number(),
    longitude: z.number(),
    radius_km: z.number().positive().default(5)
  }).optional()
});

export const UpdateIncidentStatusSchema = z.object({
  status: z.enum(["investigating", "verified", "monitoring", "resolved", "reopened", "closed"]),
  message: z.string().min(3)
});

export const ClaimResolutionSchema = z.object({
  incident_id: z.string().uuid(),
  description: z.string().min(5),
  observed_at: z.string().datetime().optional().default(() => new Date().toISOString())
});

export const MonitorIncidentsSchema = z.object({
  incident_ids: z.array(z.string().uuid()).optional(),
  mode: z.enum(["active", "all"]).optional().default("active")
});

export const GrokAnalysisOutputSchema = z.object({
  classification: z.object({
    category: z.string(),
    issue_summary: z.string(),
    location_name: z.string()
  }),
  verification: z.object({
    outcome: z.enum(["verified", "partially_verified", "unverified", "contradicted"]),
    explanation: z.string(),
    supporting_evidence_ids: z.array(z.string()),
    contradicting_evidence_ids: z.array(z.string()),
    unknowns: z.array(z.string())
  }),
  scores: z.object({
    evidence_confidence: z.enum(["low", "medium", "high"]),
    environmental_severity: z.enum(["unknown", "low", "moderate", "high", "critical"]),
    incident_escalation: z.enum(["decreasing", "stable", "increasing", "unknown"])
  }),
  risk: z.object({
    threshold_assessed: z.boolean(),
    standard_id: z.string().nullable(),
    explanation: z.string()
  }),
  recommended_actions: z.array(z.string()),
  user_facing_summary: z.string()
});

export type GrokAnalysisOutput = z.infer<typeof GrokAnalysisOutputSchema>;
