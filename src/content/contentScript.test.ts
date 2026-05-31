// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

type RuntimeListener = (message: unknown) => boolean;

describe("contentScript capture overlay", () => {
  let runtimeListener: RuntimeListener | null = null;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = "";
    document.title = "Example Page";
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900
    });
    runtimeListener = null;

    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener: vi.fn((listener: RuntimeListener) => {
            runtimeListener = listener;
          })
        }
      }
    });

    // @ts-expect-error The content script is intentionally a classic script for injection.
    await import("./contentScript");
  });

  it("blocks interaction with a Shadow DOM capture layer and records click context", () => {
    expect(runtimeListener).toBeTypeOf("function");

    runtimeListener?.({
      type: "snapissue:content-start-capture",
      source: "popup"
    });

    const host = document.getElementById("snapissue-overlay-host");
    expect(host).not.toBeNull();
    expect(host?.style.pointerEvents).toBe("auto");
    expect(host?.shadowRoot?.querySelector(".capture-layer")).not.toBeNull();

    host?.shadowRoot
      ?.querySelector("[data-capture-layer]")
      ?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: 321,
          clientY: 222
        })
      );

    expect(host?.shadowRoot?.textContent).toContain("Issue draft");
    expect(host?.shadowRoot?.textContent).toContain("Example Page");
    expect(host?.shadowRoot?.textContent).toContain("1440 x 900");
    expect(host?.shadowRoot?.textContent).toContain("x=321, y=222");
  });

  it("canceling capture removes the overlay and restores the page", () => {
    runtimeListener?.({
      type: "snapissue:content-start-capture",
      source: "command"
    });

    document
      .getElementById("snapissue-overlay-host")
      ?.shadowRoot?.querySelector("[data-cancel]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("snapissue-overlay-host")).toBeNull();
  });
});
