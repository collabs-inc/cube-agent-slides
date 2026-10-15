import { beforeEach, describe, expect, it, vi } from "vitest";

import { runWithRequestContext } from "@agent-native/core/server";

import { getDeckUrl, getExportUrl, getSlidesAppUrl } from "./_app-url.js";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("slides app URLs", () => {
  it("preserves workspace gateway URLs and APP_BASE_PATH", () => {
    vi.stubEnv("WORKSPACE_GATEWAY_URL", "https://workspace.example.test");
    vi.stubEnv("APP_BASE_PATH", "/slides");

    expect(getSlidesAppUrl()).toBe("https://workspace.example.test/slides");
    expect(getDeckUrl("deck-1")).toBe(
      "https://workspace.example.test/slides/deck/deck-1",
    );
  });

  it("does not duplicate APP_BASE_PATH when APP_URL is already scoped", () => {
    vi.stubEnv("APP_URL", "https://workspace.example.test/slides/");
    vi.stubEnv("APP_BASE_PATH", "/slides");

    expect(getDeckUrl("deck-2")).toBe(
      "https://workspace.example.test/slides/deck/deck-2",
    );
  });

  it("prefers the workspace gateway over a local app URL", () => {
    vi.stubEnv("APP_URL", "http://localhost:8086");
    vi.stubEnv("WORKSPACE_GATEWAY_URL", "https://workspace.example.test");
    vi.stubEnv("APP_BASE_PATH", "/slides");

    expect(getDeckUrl("deck-4")).toBe(
      "https://workspace.example.test/slides/deck/deck-4",
    );
  });

  it("uses hosting URL env vars for generated workspace deploys", () => {
    vi.stubEnv("URL", "https://generated-workspace.netlify.app");
    vi.stubEnv("APP_BASE_PATH", "/slides");

    expect(getExportUrl("deck.pptx")).toBe(
      "https://generated-workspace.netlify.app/slides/api/exports/deck.pptx",
    );
  });

  it("scopes hosted PPTX links to the deck and note preference", () => {
    vi.stubEnv("APP_URL", "https://workspace.example.test/slides");
    vi.stubEnv("APP_BASE_PATH", "/slides");

    expect(
      getExportUrl("quarterly-review.pptx", {
        deckId: "deck 1",
        includeNotes: false,
        exportRevision: "a".repeat(64),
      }),
    ).toBe(
      `https://workspace.example.test/slides/api/exports/quarterly-review.pptx?deckId=deck+1&includeNotes=false&exportRevision=${"a".repeat(64)}`,
    );
  });

  it("returns a relative Cube URL without request context", () => {
    expect(getDeckUrl("deck-3")).toBe(
      "/deck/deck-3",
    );
  });
});

 it("uses the incoming Cube gate origin", async () => {
 await runWithRequestContext({ userEmail: "dev@local.test", requestOrigin: "https://cube-app.example.test" }, async () => {
 expect(getDeckUrl("saved")).toBe("https://cube-app.example.test/deck/saved");
 });
 });

 it("supports relative exports without request context", () => {
 expect(getExportUrl("deck.pptx", {deckId:"deck 1"})).toBe("/api/exports/deck.pptx?deckId=deck+1");
 });
