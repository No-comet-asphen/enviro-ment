// backend/src/store.ts
import type {
  Incident,
  Report,
  Evidence,
  Measurement,
  Standard,
  TimelineEvent,
  Subscription
} from "./types.ts";
import { getSupabaseClient } from "./supabase.client.ts";
import crypto from "node:crypto";

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class MemoryStore {
  reports: Map<string, Report> = new Map();
  incidents: Map<string, Incident> = new Map();
  evidence: Map<string, Evidence> = new Map();
  measurements: Map<string, Measurement> = new Map();
  standards: Map<string, Standard> = new Map();
  timeline: Map<string, TimelineEvent> = new Map();
  subscriptions: Map<string, Subscription> = new Map();

  constructor() {
    this.seedStandards();
    this.seedMonitoringStations();
    this.seedDemoIncident();
    this.initSupabaseSync().catch(err => {
      console.warn("Supabase background sync notice:", err.message);
    });
  }

  async initSupabaseSync() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from("standards").select("*").eq("is_active", true);
      if (!error && data && data.length > 0) {
        data.forEach((std: any) => {
          this.standards.set(std.id, std as Standard);
        });
        console.log(`Synced ${data.length} regulatory standards from Supabase.`);
      }
    } catch (_e) {}
  }

  async syncReport(report: Report) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from("reports").insert({
        id: report.id,
        user_id: report.user_id,
        title: report.title,
        description: report.description,
        category: report.category,
        location_name: report.location_name,
        latitude: report.latitude,
        longitude: report.longitude,
        observed_at: report.observed_at,
        status: report.status,
        incident_id: report.incident_id,
        created_at: report.created_at
      });
    } catch (_e) {}
  }

  async syncIncident(incident: Incident) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from("incidents").upsert({
        id: incident.id,
        title: incident.title,
        summary: incident.summary,
        category: incident.category,
        status: incident.status,
        severity: incident.severity,
        evidence_confidence: incident.evidence_confidence,
        escalation: incident.escalation,
        latitude: incident.latitude,
        longitude: incident.longitude,
        location_name: incident.location_name,
        first_reported_at: incident.first_reported_at,
        last_updated_at: incident.last_updated_at,
        resolved_at: incident.resolved_at,
        created_at: incident.created_at
      });
    } catch (_e) {}
  }

  async syncEvidence(ev: Evidence) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from("evidence").insert({
        id: ev.id,
        incident_id: ev.incident_id,
        report_id: ev.report_id,
        source_name: ev.source_name,
        source_type: ev.source_type,
        title: ev.title,
        url: ev.url,
        excerpt: ev.excerpt,
        published_at: ev.published_at,
        retrieved_at: ev.retrieved_at,
        stance: ev.stance,
        reliability: ev.reliability,
        content_hash: ev.content_hash,
        metadata: ev.metadata || {}
      });
    } catch (_e) {}
  }

  async syncTimeline(tl: TimelineEvent) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from("incident_timeline").insert({
        id: tl.id,
        incident_id: tl.incident_id,
        event_type: tl.event_type,
        message: tl.message,
        metadata: tl.metadata || {},
        created_at: tl.created_at
      });
    } catch (_e) {}
  }

  private seedStandards() {
    const defaultStandards: Omit<Standard, "id">[] = [
      {
        authority: "CPCB (Central Pollution Control Board)",
        standard_name: "NAAQS 2009",
        parameter: "PM2.5",
        medium: "ambient_air",
        unit: "µg/m³",
        limit_value: 60.0,
        comparator: "lte",
        averaging_period: "24-hour",
        applicable_context: "Residential, Rural and other Areas",
        source_url: "https://cpcb.nic.in/air-pollution/",
        is_active: true
      },
      {
        authority: "CPCB (Central Pollution Control Board)",
        standard_name: "NAAQS 2009",
        parameter: "PM10",
        medium: "ambient_air",
        unit: "µg/m³",
        limit_value: 100.0,
        comparator: "lte",
        averaging_period: "24-hour",
        applicable_context: "Residential, Rural and other Areas",
        source_url: "https://cpcb.nic.in/air-pollution/",
        is_active: true
      },
      {
        authority: "CPCB (Central Pollution Control Board)",
        standard_name: "NAAQS 2009",
        parameter: "NO2",
        medium: "ambient_air",
        unit: "µg/m³",
        limit_value: 80.0,
        comparator: "lte",
        averaging_period: "24-hour",
        applicable_context: "Residential and other Areas",
        source_url: "https://cpcb.nic.in/air-pollution/",
        is_active: true
      },
      {
        authority: "BIS (Bureau of Indian Standards)",
        standard_name: "IS 10500:2012",
        parameter: "pH",
        medium: "drinking_water",
        unit: "pH",
        limit_value: 8.5,
        comparator: "range",
        averaging_period: "Instantaneous",
        applicable_context: "Drinking water acceptable range: 6.5 to 8.5",
        source_url: "https://law.resource.org/pub/in/bis/S02/is.10500.2012.pdf",
        is_active: true
      },
      {
        authority: "BIS (Bureau of Indian Standards)",
        standard_name: "IS 10500:2012",
        parameter: "Turbidity",
        medium: "drinking_water",
        unit: "NTU",
        limit_value: 1.0,
        comparator: "lte",
        averaging_period: "Instantaneous",
        applicable_context: "Potable drinking water maximum permissible limit",
        source_url: "https://law.resource.org/pub/in/bis/S02/is.10500.2012.pdf",
        is_active: true
      },
      {
        authority: "BIS (Bureau of Indian Standards)",
        standard_name: "IS 10500:2012",
        parameter: "TDS",
        medium: "drinking_water",
        unit: "mg/L",
        limit_value: 500.0,
        comparator: "lte",
        averaging_period: "Instantaneous",
        applicable_context: "Total Dissolved Solids potable limit",
        source_url: "https://law.resource.org/pub/in/bis/S02/is.10500.2012.pdf",
        is_active: true
      },
      {
        authority: "CPCB (Noise Rules 2000)",
        standard_name: "Ambient Noise Standards",
        parameter: "Leq",
        medium: "noise",
        unit: "dB(A)",
        limit_value: 55.0,
        comparator: "lte",
        averaging_period: "Day (06:00-22:00)",
        applicable_context: "Residential Area Daytime Permissible Noise Level",
        source_url: "https://cpcb.nic.in/noise-pollution/",
        is_active: true
      },
      {
        authority: "CPCB (Water Quality)",
        standard_name: "Designated Best Use Class C",
        parameter: "Dissolved Oxygen (DO)",
        medium: "surface_water",
        unit: "mg/L",
        limit_value: 4.0,
        comparator: "gte",
        averaging_period: "Instantaneous",
        applicable_context: "Surface water drinking source after conventional treatment",
        source_url: "https://cpcb.nic.in/water-pollution/",
        is_active: true
      }
    ];

    defaultStandards.forEach(std => {
      const id = crypto.randomUUID();
      this.standards.set(id, { id, ...std });
    });
  }

  private seedMonitoringStations() {
    const now = new Date().toISOString();
    const stations: Omit<Measurement, "id">[] = [
      {
        station_name: "Anand Vihar CAAQMS Station",
        parameter: "PM2.5",
        value: 142.5,
        unit: "µg/m³",
        measured_at: now,
        latitude: 28.6469,
        longitude: 77.3160,
        source_name: "CPCB Open Environmental Portal",
        source_url: "https://cpcb.nic.in/caaqms/",
        quality_flag: "valid"
      },
      {
        station_name: "Anand Vihar CAAQMS Station",
        parameter: "PM10",
        value: 285.0,
        unit: "µg/m³",
        measured_at: now,
        latitude: 28.6469,
        longitude: 77.3160,
        source_name: "CPCB Open Environmental Portal",
        source_url: "https://cpcb.nic.in/caaqms/",
        quality_flag: "valid"
      },
      {
        station_name: "Bandra Kurla Complex (BKC) Monitoring Hub",
        parameter: "PM2.5",
        value: 78.0,
        unit: "µg/m³",
        measured_at: now,
        latitude: 19.0657,
        longitude: 72.8687,
        source_name: "MPCB Ambient Network",
        source_url: "https://mpcb.gov.in/",
        quality_flag: "valid"
      },
      {
        station_name: "Example Locality Municipal Water Testing Lab",
        parameter: "Turbidity",
        value: 4.8,
        unit: "NTU",
        measured_at: now,
        latitude: 19.0,
        longitude: 73.1,
        source_name: "Municipal Water Works Quality Cell",
        source_url: "https://water.example.gov.in/test-reports",
        quality_flag: "valid"
      },
      {
        station_name: "Sector 10 Supply Sump Station",
        parameter: "pH",
        value: 7.2,
        unit: "pH",
        measured_at: now,
        latitude: 19.01,
        longitude: 73.09,
        source_name: "Municipal Water Works Quality Cell",
        source_url: "https://water.example.gov.in/test-reports",
        quality_flag: "valid"
      }
    ];

    stations.forEach(m => {
      const id = crypto.randomUUID();
      this.measurements.set(id, { id, ...m });
    });
  }

  private seedDemoIncident() {
    const incidentId = crypto.randomUUID();
    const now = new Date();
    const firstReported = new Date(now.getTime() - 7200000).toISOString();
    const lastUpdated = new Date(now.getTime() - 1800000).toISOString();

    const incident: Incident = {
      id: incidentId,
      title: "Water supply interruption in Example Locality",
      summary: "Multiple citizen reports and feeder main pipeline maintenance confirm disruption of municipal tap water in Sector 10.",
      category: "water_supply",
      status: "investigating",
      severity: "moderate",
      evidence_confidence: "high",
      escalation: "stable",
      latitude: 19.0,
      longitude: 73.1,
      location_name: "Sector 10, Example Locality",
      first_reported_at: firstReported,
      last_updated_at: lastUpdated,
      created_at: firstReported
    };
    this.incidents.set(incidentId, incident);

    // Timeline events
    const timeline1: TimelineEvent = {
      id: crypto.randomUUID(),
      incident_id: incidentId,
      event_type: "report_received",
      message: "Initial citizen report submitted: No tap water supply since morning.",
      created_at: firstReported
    };
    const timeline2: TimelineEvent = {
      id: crypto.randomUUID(),
      incident_id: incidentId,
      event_type: "evidence_added",
      message: "Official Public Works notice retrieved corroborating emergency feeder pipeline repair.",
      created_at: lastUpdated
    };
    this.timeline.set(timeline1.id, timeline1);
    this.timeline.set(timeline2.id, timeline2);

    // Initial Evidence
    const evId = crypto.randomUUID();
    this.evidence.set(evId, {
      id: evId,
      incident_id: incidentId,
      source_name: "Municipal Water Supply Board",
      source_type: "government",
      title: "Public Works Notification: Feeder Main Line Repair & Pressure Normalization",
      url: "https://municipal-water.gov.in/bulletin/2026-11-water-pipeline-works",
      excerpt: "Scheduled emergency pipe replacement on the 900mm primary transmission header. Residents are advised of reduced pressure and temporary stoppage between 06:00 and 16:00 hrs.",
      published_at: firstReported,
      retrieved_at: lastUpdated,
      stance: "supports",
      reliability: "high"
    });
  }

  // --- Spatial Queries ---
  findNearbyIncidents(
    lat: number,
    lon: number,
    radiusKm: number,
    category?: string
  ): Array<Incident & { distance_km: number }> {
    const results: Array<Incident & { distance_km: number }> = [];

    for (const incident of this.incidents.values()) {
      if (category && incident.category !== category) continue;
      if (incident.status === "closed") continue;

      const dist = haversineDistanceKm(lat, lon, incident.latitude, incident.longitude);
      if (dist <= radiusKm) {
        results.push({ ...incident, distance_km: Math.round(dist * 100) / 100 });
      }
    }

    return results.sort((a, b) => a.distance_km - b.distance_km);
  }

  findMeasurements(
    lat?: number,
    lon?: number,
    radiusKm?: number,
    parameter?: string
  ): Measurement[] {
    const results: Measurement[] = [];

    for (const m of this.measurements.values()) {
      if (parameter && m.parameter.toLowerCase() !== parameter.toLowerCase()) {
        continue;
      }
      if (lat !== undefined && lon !== undefined && radiusKm !== undefined) {
        const dist = haversineDistanceKm(lat, lon, m.latitude, m.longitude);
        if (dist > radiusKm) continue;
      }
      results.push(m);
    }

    return results.sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime());
  }

  findMapFeatures(bbox?: { south: number; west: number; north: number; east: number }, category?: string) {
    const features: any[] = [];

    for (const incident of this.incidents.values()) {
      if (category && category !== "all" && incident.category !== category) {
        continue;
      }

      if (bbox) {
        if (
          incident.latitude < bbox.south ||
          incident.latitude > bbox.north ||
          incident.longitude < bbox.west ||
          incident.longitude > bbox.east
        ) {
          continue;
        }
      }

      // Count reports linked to incident
      let reportCount = 0;
      for (const r of this.reports.values()) {
        if (r.incident_id === incident.id) reportCount++;
      }
      if (reportCount === 0) reportCount = 1;

      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [incident.longitude, incident.latitude] // GeoJSON [lon, lat]
        },
        properties: {
          id: incident.id,
          kind: "incident",
          title: incident.title,
          category: incident.category,
          severity: incident.severity,
          status: incident.status,
          report_count: reportCount
        }
      });
    }

    return features;
  }
}

export const db = new MemoryStore();
