// backend/src/services/evidence.service.ts
import { db } from "../store.ts";
import type { Evidence } from "../types.ts";
import { getResearchProvider } from "../../../supabase/functions/_shared/research.ts";
import type { SearchRequest } from "../../../supabase/functions/_shared/research.ts";
import crypto from "node:crypto";

export async function searchAndIngestEvidence(
  incidentId: string,
  searchReq: SearchRequest,
  reportId?: string
): Promise<Evidence[]> {
  const provider = getResearchProvider();
  const rawResults = await provider.search(searchReq);
  const ingested: Evidence[] = [];
  const now = new Date().toISOString();

  for (const item of rawResults) {
    const contentToHash = `${item.url}|${item.title}|${item.excerpt.slice(0, 50)}`;
    const hash = crypto.createHash("sha256").update(contentToHash).digest("hex");

    // Check deduplication
    let alreadyExists = false;
    for (const existing of db.evidence.values()) {
      if (existing.content_hash === hash && existing.incident_id === incidentId) {
        alreadyExists = true;
        break;
      }
    }

    if (!alreadyExists) {
      const evidenceRecord: Evidence = {
        id: crypto.randomUUID(),
        incident_id: incidentId,
        report_id: reportId || null,
        source_name: item.source_name,
        source_type: item.source_type,
        title: item.title,
        url: item.url,
        excerpt: item.excerpt,
        published_at: item.published_at || null,
        retrieved_at: now,
        stance: item.stance || "supports",
        reliability: item.reliability || "high",
        content_hash: hash,
        metadata: { query: searchReq.query }
      };

      db.evidence.set(evidenceRecord.id, evidenceRecord);
      db.syncEvidence(evidenceRecord);
      ingested.push(evidenceRecord);
    }
  }

  return ingested;
}
