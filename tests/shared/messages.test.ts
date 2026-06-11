import { describe, expect, it } from "vitest";
import { isOrganizerRequest } from "../../src/shared/messages";

describe("isOrganizerRequest", () => {
  it("accepts known messages and rejects malformed input", () => {
    expect(
      isOrganizerRequest({
        type: "prepare-task",
        windowId: 7,
        ownerToken: "panel-1",
      }),
    ).toBe(true);
    expect(isOrganizerRequest({ type: "prepare-task", windowId: "7" })).toBe(
      false,
    );
    expect(isOrganizerRequest({ type: "unknown" })).toBe(false);
  });
});
