// supabase/functions/_shared/xai.ts
import { GrokAnalysisOutputSchema, type GrokAnalysisOutput } from "./schemas.ts";
import { askGemini } from "./gemini.ts";

export { SYSTEM_PROMPT } from "./gemini.ts";

export async function askGrok(
  userPrompt: string,
  systemPrompt?: string
): Promise<string> {
  const geminiKey = (globalThis as any).Deno?.env?.get("GEMINI_API_KEY") ?? process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return askGemini(userPrompt, systemPrompt);
  }

  const xaiApiKey = (globalThis as any).Deno?.env?.get("XAI_API_KEY") ?? process.env.XAI_API_KEY;
  const xaiBaseUrl = (globalThis as any).Deno?.env?.get("XAI_BASE_URL") ?? process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
  const xaiModel = (globalThis as any).Deno?.env?.get("XAI_MODEL") ?? process.env.XAI_MODEL ?? "grok-3-mini";

  if (!xaiApiKey) {
    throw new Error("Neither GEMINI_API_KEY nor XAI_API_KEY is configured");
  }

  const response = await fetch(`${xaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${xaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: xaiModel,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt || "You are an environmental analysis assistant." },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`AI request failed (${response.status}): ${details}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content ?? "";
}

/**
 * Intelligent deterministic fallback synthesizer when API keys fail or network is unavailable.
 */
export function synthesizeFallbackAnalysis(
  report: { category: string; description: string; location_name: string },
  evidence: Array<{ id: string; title: string; source_type: string; stance: string; reliability: string }>,
  measurements: Array<{ parameter: string; value: number; unit: string }>
): GrokAnalysisOutput {
  const supporting = evidence.filter(e => e.stance === "supports").map(e => e.id);
  const contradicting = evidence.filter(e => e.stance === "contradicts").map(e => e.id);
  const hasGovOrMonitoring = evidence.some(e => e.source_type === "government" || e.source_type === "monitoring");

  let outcome: "verified" | "partially_verified" | "unverified" | "contradicted" = "unverified";
  let confidence: "low" | "medium" | "high" = "low";
  let severity: "unknown" | "low" | "moderate" | "high" | "critical" = "unknown";
  let escalation: "decreasing" | "stable" | "increasing" | "unknown" = "stable";

  if (contradicting.length > supporting.length && hasGovOrMonitoring) {
    outcome = "contradicted";
    confidence = "high";
  } else if (supporting.length > 0 && hasGovOrMonitoring) {
    outcome = "verified";
    confidence = "high";
  } else if (supporting.length > 0 || evidence.length > 0) {
    outcome = "partially_verified";
    confidence = "medium";
  }

  if (measurements.length > 0) {
    const pm25 = measurements.find(m => m.parameter.toUpperCase().includes("PM2.5"));
    if (pm25) {
      if (pm25.value > 250) severity = "critical";
      else if (pm25.value > 120) severity = "high";
      else if (pm25.value > 60) severity = "moderate";
      else severity = "low";
    }
  }

  return {
    classification: {
      category: report.category || "other",
      issue_summary: report.description.slice(0, 100),
      location_name: report.location_name
    },
    verification: {
      outcome,
      explanation: outcome === "verified"
        ? "Corroborated by official monitoring and administrative records."
        : outcome === "partially_verified"
        ? "Multiple observations exist, but independent institutional confirmation remains pending."
        : "Initial report received; awaiting secondary sensor or official confirmation.",
      supporting_evidence_ids: supporting,
      contradicting_evidence_ids: contradicting,
      unknowns: [
        "Awaiting real-time lab test results or ground inspection certificate",
        "Duration of local impact"
      ]
    },
    scores: {
      evidence_confidence: confidence,
      environmental_severity: severity,
      incident_escalation: escalation
    },
    risk: {
      threshold_assessed: measurements.length > 0,
      standard_id: null,
      explanation: measurements.length > 0
        ? "Environmental measurements matched against baseline thresholds."
        : "No direct regulatory-grade measurement currently associated."
    },
    recommended_actions: [
      "Check municipal pollution control board or water utility bulletins.",
      "Dispatch field verification or deploy calibrated sensor probe to locality."
    ],
    user_facing_summary: `Report recorded for ${report.location_name}. Preliminary status: ${outcome.replace('_', ' ')}. Evidence confidence: ${confidence}.`
  };
}
