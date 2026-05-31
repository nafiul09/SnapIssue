// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

type RuntimeListener = (message: unknown) => boolean;

describe("contentScript capture overlay", () => {
  let runtimeListener: RuntimeListener | null = null;
  let sendMessage: ReturnType<typeof vi.fn>;
  let storageValues: Record<string, unknown>;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = "";
    document.title = "Example Page";
    Reflect.deleteProperty(window, "__snapissueContentInstalled");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900
    });
    runtimeListener = null;
    storageValues = {};
    sendMessage = vi.fn(async () => ({
      ok: true,
      issueNumber: 123,
      issueUrl: "https://github.com/acme/web/issues/123"
    }));

    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeListener) => {
            runtimeListener = listener;
          })
        }
      },
      storage: {
        local: {
          get: vi.fn(async (keys: string[]) =>
            Object.fromEntries(keys.map((key) => [key, storageValues[key]]))
          )
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
    expect(
      Array.from(host?.shadowRoot?.querySelectorAll("[data-editor-command]") ?? []).map(
        (button) => (button as HTMLButtonElement).dataset.editorCommand
      )
    ).toEqual([
      "bold",
      "italic",
      "inline-code",
      "code-block",
      "bullet-list",
      "numbered-list",
      "task-list",
      "link",
      "quote",
      "undo",
      "redo"
    ]);
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

  it("submits Markdown from the WYSIWYG editor instead of HTML", async () => {
    storageValues = {
      repoCatalog: {
        owners: [
          {
            owner: "acme",
            repos: [
              {
                owner: "acme",
                name: "web",
                fullName: "acme/web",
                private: false
              }
            ]
          }
        ]
      },
      labelCache: {
        "acme/web": {
          labels: [{ id: 1, name: "bug", color: "d73a4a" }]
        }
      }
    };

    runtimeListener?.({
      type: "snapissue:content-start-capture",
      source: "popup"
    });
    const host = document.getElementById("snapissue-overlay-host");
    host?.shadowRoot
      ?.querySelector("[data-capture-layer]")
      ?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: 321,
          clientY: 222
        })
      );

    await flushAsyncWork();

    const owner = host?.shadowRoot?.querySelector("[data-owner]");
    expect(owner?.textContent).toContain("acme");
    if (owner instanceof HTMLSelectElement) {
      owner.value = "acme";
      owner.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const repo = host?.shadowRoot?.querySelector("[data-repo]");
    if (repo instanceof HTMLSelectElement) {
      repo.value = "web";
      repo.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const title = host?.shadowRoot?.querySelector("[data-title]");
    if (title instanceof HTMLInputElement) {
      title.value = "Broken button";
      title.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const editor = host?.shadowRoot?.querySelector("[data-editor]");
    if (editor instanceof HTMLElement) {
      editor.innerHTML =
        "<p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><blockquote><div>Quote</div></blockquote>";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const label = host?.shadowRoot?.querySelector("[data-label]");
    if (label instanceof HTMLInputElement) {
      label.checked = true;
      label.dispatchEvent(new Event("change", { bubbles: true }));
    }

    host?.shadowRoot
      ?.querySelector("[data-form]")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await Promise.resolve();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "snapissue:create-context-issue",
        payload: expect.objectContaining({
          owner: "acme",
          repo: "web",
          title: "Broken button",
          labels: ["bug"],
          description: expect.stringContaining("**Bold** and *italic*")
        })
      })
    );
    const payload = sendMessage.mock.calls[0][0].payload;
    expect(payload.description).toContain("- One");
    expect(payload.description).toContain("> Quote");
    expect(payload.description).not.toContain("<strong>");
  });
});

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
