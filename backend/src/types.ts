// backend/src/types.ts

export type IncidentStatus =
  | "investigating"
  | "verified"
  | "monitoring"
  | "resolved"
  | "reopened"
  | "closed";

export type Severity =
  | "unknown"
  | "low"
  | "moderate"
  | "high"
  | "critical";

export type EvidenceConfidence =
  | "low"
  | "medium"
  | "high";

export type Escalation =
  | "decreasing"
  | "stable"
  | "increasing"
  | "unknown";

export type VerificationOutcome =
  | "verified"
  | "partially_verified"
  | "unverified"
  | "contradicted";

export type SourceType =
  | "government"
  | "monitoring"
  | "news"
  | "citizen"
  | "research";

export type EvidenceStance =
  | "supports"
  | "contradicts"
  | "contextual"
  | "unknown";

export type EvidenceReliability =
  | "high"
  | "medium"
  | "low"
  | "unassessed";

export interface Report {
  id: string;
  user_id?: string | null;
  title: string;
  description: string;
  category: string;
  location_name: string;
  latitude: number;
  longitude: number;
  observed_at: string;
  status: "submitted" | "processing" | "reviewed" | "linked" | "rejected";
  incident_id?: string | null;
  created_at: string;
}

export interface Incident {
  id: string;
  title: string;
  summary: string;
  category: string;
  status: IncidentStatus;
  severity: Severity;
  evidence_confidence: EvidenceConfidence;
  escalation: Escalation;
  latitude: number;
  longitude: number;
  location_name: string;
  first_reported_at: string;
  last_updated_at: string;
  resolved_at?: string | null;
  created_at: string;
}

export interface Evidence {
  id: string;
  incident_id: string;
  report_id?: string | null;
  source_name: string;
  source_type: SourceType;
  title: string;
  url: string;
  excerpt: string;
  published_at?: string | null;
  retrieved_at: string;
  stance: EvidenceStance;
  reliability: EvidenceReliability;
  content_hash?: string;
  metadata?: Record<string, any>;
}

export interface Measurement {
  id: string;
  incident_id?: string | null;
  station_name: string;
  parameter: string;
  value: number;
  unit: string;
  measured_at: string;
  latitude: number;
  longitude: number;
  source_name: string;
  source_url: string;
  quality_flag: "valid" | "suspect" | "invalid" | "unknown";
}

export interface Standard {
  id: string;
  authority: string;
  standard_name: string;
  parameter: string;
  medium: "ambient_air" | "drinking_water" | "surface_water" | "noise" | "emissions";
  unit: string;
  limit_value: number | null;
  comparator: "gt" | "gte" | "lt" | "lte" | "range" | "categorical";
  averaging_period: string;
  applicable_context: string;
  source_url: string;
  effective_from?: string | null;
  effective_to?: string | null;
  reviewed_by?: string | null;
  is_active: boolean;
}

export interface TimelineEvent {
  id: string;
  incident_id: string;
  event_type:
    | "report_received"
    | "evidence_added"
    | "status_changed"
    | "notice_found"
    | "risk_changed"
    | "resolution_claimed";
  message: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  incident_id?: string | null;
  category?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
  enabled: boolean;
  created_at: string;
}
