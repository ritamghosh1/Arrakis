import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeGitUrl,
  sha1Hex,
  computeGitObjectSha,
  simulateGitInspection,
  verifyGitIntegrity,
  gitIntegrityRegistry,
} from "./git-integrity.ts";

test("Git Integrity Simulation — URL Normalization & Deterministic SHA-1", () => {
  assert.equal(
    normalizeGitUrl("https://github.com/ritamghosh1/Arrakis.git/"),
    "github.com/ritamghosh1/arrakis"
  );
  assert.equal(
    normalizeGitUrl("http://www.github.com/alice/project"),
    "github.com/alice/project"
  );

  const hashA = sha1Hex("hello world");
  const hashB = sha1Hex("hello world");
  assert.equal(hashA, hashB);
  assert.equal(hashA.length, 40);
  assert.match(hashA, /^[0-9a-f]{40}$/);

  // Known SHA-1 test vector for "hello world": 2aae6c35c94fcfb415dbe95f408b9ce91ee846ed
  assert.equal(hashA, "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
});

test("Git Integrity Simulation — Calculates Git-like SHA for each file using commit history", () => {
  const result = simulateGitInspection("https://github.com/myteam/hackathon-winner");

  assert.ok(result.commitSha.length === 40, "Calculates 40-character commit SHA");
  assert.ok(result.treeSha.length === 40, "Calculates 40-character tree SHA");
  assert.ok(result.files.length >= 5, "Simulates file blobs across repository commit history");

  // Verify file blobs have git object hashes
  const paths = result.files.map((f) => f.path);
  assert.ok(paths.includes("src/index.ts"));
  assert.ok(paths.includes("package.json"));
  assert.ok(paths.includes("README.md"));
  assert.ok(paths.includes(".git/config"));

  for (const file of result.files) {
    assert.equal(file.blobSha.length, 40, `File ${file.path} must have 40-char SHA`);
    assert.ok(file.sizeBytes > 0, `File ${file.path} has positive byte size`);
  }
});

test("Git Integrity Simulation — Flags duplicate when 2 projects have the same GitHub URL / Git SHA", () => {
  const uniqueUrl = `https://github.com/test-org/unique-tool-${Date.now()}`;

  // First check: should be clean
  const check1 = verifyGitIntegrity(uniqueUrl, {
    projectMeta: { id: "proj_first_1", title: "Original Tool Alpha", authorHandle: "alice" },
    registerIfClean: true,
  });

  assert.equal(check1.isDuplicate, false, "First submission must be unique");
  assert.equal(check1.isFlagged, false, "First submission must not be flagged");

  // Second check with the exact same URL: must be flagged!
  const check2 = verifyGitIntegrity(uniqueUrl, {
    projectMeta: { id: "proj_second_2", title: "Copied Tool Beta", authorHandle: "bob" },
  });

  assert.equal(check2.isDuplicate, true, "Duplicate project must be detected");
  assert.equal(check2.isFlagged, true, "Duplicate project must be flagged");
  assert.equal(check2.matchedProject?.title, "Original Tool Alpha");
  assert.equal(check2.matchedProject?.authorHandle, "alice");
  assert.equal(check2.commitSha, check1.commitSha, "Commit SHAs must match");
});

test("Git Integrity Simulation — Pre-seeded flagship repos are detected and flagged immediately", () => {
  // Arrakis repo is pre-seeded
  const flagCheck = verifyGitIntegrity("https://github.com/ritamghosh1/Arrakis");
  assert.equal(flagCheck.isFlagged, true, "Pre-seeded repository must be flagged if reused");
  assert.ok(flagCheck.matchedProject, "Must provide matched project details");
  assert.equal(flagCheck.matchedProject?.authorHandle, "ritam");
});
