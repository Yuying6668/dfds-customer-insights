import assert from "node:assert/strict";
import test from "node:test";
import { activateDatasetRun } from "../app/scripts/services/dataset-run-api.mjs";

test("saves cleaned data before publishing the uploaded dataset run", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () => url.endsWith("/save-cleaned")
        ? { batch: { id: "batch-1", version: "v20260813-102842" } }
        : { run: { analysisState: "processing" } }
    };
  };

  const result = await activateDatasetRun("batch-1", { accessToken: "project-user", fetchImpl });

  assert.deepEqual(requests.map(({ url, options }) => [url, options.method]), [
    ["/api/upload-batches/batch-1/save-cleaned", "POST"],
    ["/api/upload-batches/batch-1/publish", "POST"]
  ]);
  assert.equal(result.batch.version, "v20260813-102842");
  assert.equal(result.run.analysisState, "processing");
});
