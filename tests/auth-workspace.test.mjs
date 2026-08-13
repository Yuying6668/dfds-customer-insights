import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkspaceDestination, startWorkspaceSession } from "../app/lib/auth.js";

test("sends a project user to the data-intake workspace", () => {
  assert.equal(resolveWorkspaceDestination("project_user", "project_user", "/overview"), "/it-data-flow");
});

test("sends an administrator to the monitoring workspace", () => {
  assert.equal(resolveWorkspaceDestination("administrator", "administrator", "/it-data-flow"), "/agent-control");
});

test("does not allow a project user to enter the administrator workspace", () => {
  assert.throws(
    () => resolveWorkspaceDestination("project_user", "administrator", "/it-data-flow"),
    /Administrator access is required/
  );
});

test("starts a project-user session without credentials", () => {
  const storage = new Map();
  storage.setItem = (key, value) => storage.set(key, value);
  const destination = startWorkspaceSession("project_user", storage);

  assert.equal(destination, "/it-data-flow");
  assert.equal(storage.get("dfds-access-token"), "public-project-user");
  assert.equal(storage.get("dfds-account-role"), "project_user");
  assert.equal(storage.get("dfds-workspace-role"), "project_user");
});

test("starts an administrator session without credentials", () => {
  const storage = new Map();
  storage.setItem = (key, value) => storage.set(key, value);
  const destination = startWorkspaceSession("administrator", storage);

  assert.equal(destination, "/agent-control");
  assert.equal(storage.get("dfds-access-token"), "public-administrator");
  assert.equal(storage.get("dfds-account-role"), "administrator");
  assert.equal(storage.get("dfds-workspace-role"), "administrator");
});
