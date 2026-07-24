import { createHash } from "crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

function hashToken(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function parseVelocidadFromPlan(plan) {
  const m = plan.match(/(\d+)\s*(mbps|mb)/i);
  return m ? parseInt(m[1], 10) : null;
}

describe("cliente-app token hash", () => {
  it("produce SHA-256 hex estable", () => {
    const a = hashToken("refresh-raw-demo");
    const b = hashToken("refresh-raw-demo");
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  it("diferentes entradas producen hashes distintos", () => {
    assert.notEqual(hashToken("a"), hashToken("b"));
  });
});

describe("dashboard plan parsing", () => {
  it("extrae Mbps del plan", () => {
    assert.equal(parseVelocidadFromPlan("Fibra 100 Mbps"), 100);
    assert.equal(parseVelocidadFromPlan("50Mb"), 50);
    assert.equal(parseVelocidadFromPlan("Plan hogar"), null);
  });
});
