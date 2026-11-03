// backend/tests/api.test.ts
import http from "node:http";
import app from "../src/server.ts";

const PORT = 5999;
let server: http.Server;

function request(path: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = options.body ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      `http://localhost:${PORT}${path}`,
      {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data).toString() } : {}),
          ...options.headers
        }
      },
      (res) => {
        let raw = "";
        res.on("data", chunk => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode || 200, body: JSON.parse(raw) });
          } catch (_e) {
            resolve({ status: res.statusCode || 200, body: raw });
          }
        });
      }
    );

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log("Starting Environmental Intelligence API Test Suite...\n");
  server = app.listen(PORT);

  let passed = 0;
  let failed = 0;

  async function assertTest(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`FAIL: ${name}`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    await assertTest("Health check endpoint", async () => {
      const res = await request("/health");
      if (res.status !== 200 || !res.body.success) throw new Error("Health check failed");
    });

    // 2. 7.1 POST /create-report
    let createdReportId = "";
    let createdIncidentId = "";
    await assertTest("POST /create-report", async () => {
      const res = await request("/create-report", {
        method: "POST",
        body: {
          description: "Water has not been supplied in Sector 10 since this morning.",
          category: "water_supply",
          location: {
            name: "Sector 10, Example Locality",
            latitude: 19.0,
            longitude: 73.1
          },
          observed_at: new Date().toISOString(),
          attachment_ids: []
        }
      });
      if (res.status !== 201 || !res.body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.data.report_id || !res.body.data.incident_id) throw new Error("Missing IDs");
      createdReportId = res.body.data.report_id;
      createdIncidentId = res.body.data.incident_id;
    });

    // 3. 7.2 POST /clarify-report
    await assertTest("POST /clarify-report", async () => {
      const res = await request("/clarify-report", {
        method: "POST",
        body: {
          description: "The water is dirty.",
          location: { name: "Example Locality", latitude: 19.0, longitude: 73.1 },
          answers: []
        }
      });
      if (res.status !== 200 || !res.body.success) throw new Error(`Failed clarify: ${JSON.stringify(res.body)}`);
      if (res.body.data.is_ready !== false || !Array.isArray(res.body.data.questions)) {
        throw new Error("Invalid clarify response structure");
      }
    });

    // 4. 7.3 POST /analyze-report
    await assertTest("POST /analyze-report", async () => {
      const res = await request("/analyze-report", {
        method: "POST",
        body: {
          report_id: createdReportId,
          incident_id: createdIncidentId,
          refresh: false
        }
      });
      if (res.status !== 200 || !res.body.success) throw new Error(`Analyze report failed: ${JSON.stringify(res.body)}`);
      if (!res.body.data.analysis_id) throw new Error("Missing analysis_id");
    });

    // 5. 7.4 POST /search-evidence
    await assertTest("POST /search-evidence", async () => {
      const res = await request("/search-evidence", {
        method: "POST",
        body: {
          query: "planned water supply shutdown in Example Locality",
          category: "water_supply",
          location: { name: "Example Locality", latitude: 19.0, longitude: 73.1 }
        }
      });
      if (res.status !== 200 || !res.body.success) throw new Error(`Search failed: ${JSON.stringify(res.body)}`);
      if (!Array.isArray(res.body.data.results)) throw new Error("Results is not array");
    });

    // 6. 7.5 GET /incidents
    await assertTest("GET /incidents", async () => {
      const res = await request("/incidents?category=water_supply");
      if (res.status !== 200 || !res.body.success) throw new Error(`Get incidents failed: ${JSON.stringify(res.body)}`);
      if (!Array.isArray(res.body.data.items) || res.body.data.total < 1) throw new Error("Items empty");
    });

    // 7. 7.6 GET /incident-detail
    await assertTest("GET /incident-detail", async () => {
      const res = await request(`/incident-detail?id=${createdIncidentId}`);
      if (res.status !== 200 || !res.body.success) throw new Error(`Get incident detail failed: ${JSON.stringify(res.body)}`);
      if (res.body.data.incident.id !== createdIncidentId) throw new Error("ID mismatch");
      if (!Array.isArray(res.body.data.applicable_standards)) throw new Error("Standards missing");
    });

    // 8. 7.7 GET /map-data (GeoJSON FeatureCollection)
    await assertTest("GET /map-data", async () => {
      const res = await request("/map-data?south=18.0&west=72.0&north=20.0&east=74.0");
      if (res.status !== 200 || !res.body.success) throw new Error(`Get map data failed: ${JSON.stringify(res.body)}`);
      if (!Array.isArray(res.body.data.features)) throw new Error("features array missing");
    });

    // 9. 7.8 GET /environmental-data
    let testMeasurementId = "";
    await assertTest("GET /environmental-data", async () => {
      const res = await request("/environmental-data?parameter=PM2.5");
      if (res.status !== 200 || !res.body.success) throw new Error(`Get environmental data failed: ${JSON.stringify(res.body)}`);
      if (!Array.isArray(res.body.data.measurements) || res.body.data.measurements.length === 0) {
        throw new Error("No measurements returned");
      }
      testMeasurementId = res.body.data.measurements[0].id;
    });

    // 10. 7.9 POST /assess-risk
    await assertTest("POST /assess-risk", async () => {
      const detailRes = await request(`/incident-detail?id=${createdIncidentId}`);
      const standard = detailRes.body.data.applicable_standards.find((s: any) => s.parameter === "PM2.5");
      if (!standard) throw new Error("No PM2.5 standard found in database");

      const res = await request("/assess-risk", {
        method: "POST",
        body: {
          measurement_id: testMeasurementId,
          standard_id: standard.id
        }
      });
      if (res.status !== 200 || !res.body.success) throw new Error(`Assess risk failed: ${JSON.stringify(res.body)}`);
      if (!res.body.data.comparison_status) throw new Error("Missing comparison_status");
    });

    // 11. 7.10 GET /incident-timeline
    await assertTest("GET /incident-timeline", async () => {
      const res = await request(`/incident-timeline?incident_id=${createdIncidentId}`);
      if (res.status !== 200 || !res.body.success) throw new Error(`Timeline failed: ${JSON.stringify(res.body)}`);
      if (!Array.isArray(res.body.data.events) || res.body.data.events.length === 0) {
        throw new Error("No timeline events found");
      }
    });

    // 12. 7.11 POST /subscribe-alerts
    await assertTest("POST /subscribe-alerts", async () => {
      const res = await request("/subscribe-alerts", {
        method: "POST",
        body: {
          incident_id: createdIncidentId,
          area: { latitude: 19.0, longitude: 73.1, radius_km: 5 }
        }
      });
      if (res.status !== 200 || !res.body.success) throw new Error(`Subscribe failed: ${JSON.stringify(res.body)}`);
      if (!res.body.data.subscription_id) throw new Error("Missing subscription_id");
    });

    // 13. 7.12 PATCH /incidents
    await assertTest("PATCH /incidents", async () => {
      const res = await request(`/incidents?id=${createdIncidentId}`, {
        method: "PATCH",
        body: {
          status: "monitoring",
          message: "New measurements are being monitored after reported repair."
        }
      });
      if (res.status !== 200 || !res.body.success) throw new Error(`Patch incident failed: ${JSON.stringify(res.body)}`);
      if (res.body.data.status !== "monitoring") throw new Error("Status not updated");
    });

    // 14. 7.13 POST /incidents/claim-resolution
    await assertTest("POST /incidents/claim-resolution", async () => {
      const res = await request("/incidents/claim-resolution", {
        method: "POST",
        body: {
          incident_id: createdIncidentId,
          description: "Water supply has resumed in our building.",
          observed_at: new Date().toISOString()
        }
      });
      if (res.status !== 200 || !res.body.success) throw new Error(`Claim resolution failed: ${JSON.stringify(res.body)}`);
      if (res.body.data.incident_status !== "monitoring") throw new Error("Incident should enter monitoring");
    });

    // 15. 7.14 POST /monitor-incidents
    await assertTest("POST /monitor-incidents", async () => {
      const res = await request("/monitor-incidents", {
        method: "POST",
        body: {
          incident_ids: [createdIncidentId],
          mode: "active"
        }
      });
      if (res.status !== 200 || !res.body.success) throw new Error(`Monitor job failed: ${JSON.stringify(res.body)}`);
      if (res.body.data.checked < 1) throw new Error("Job checked 0 incidents");
    });

  } finally {
    server.close();
  }

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
