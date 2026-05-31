import { type FormEvent, useEffect, useState } from "react";
import {
  GitHubValidationError,
  validateGitHubToken
} from "../shared/githubClient";
import {
  buildR2SettingsExport,
  emptyR2Settings,
  parseR2SettingsImport,
  R2SettingsError,
  type R2Settings
} from "../shared/r2Settings";
import {
  clearGitHubCredentials,
  clearR2Settings,
  loadStoredSettings,
  saveGitHubCredentials,
  saveR2Settings,
  type LocalSettingsStorage
} from "../shared/settingsStorage";

type Notice = {
  kind: "success" | "error";
  message: string;
} | null;

type BusyAction = "github" | "r2" | "import" | "clear-github" | "clear-r2" | null;

export function OptionsApp() {
  const [githubToken, setGithubToken] = useState("");
  const [githubLogin, setGithubLogin] = useState("");
  const [r2Settings, setR2Settings] = useState<R2Settings>(() =>
    emptyR2Settings()
  );
  const [r2Json, setR2Json] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  useEffect(() => {
    void hydrateSettings();
  }, []);

  async function hydrateSettings() {
    const storage = getLocalStorage();
    if (!storage) {
      return;
    }

    const stored = await loadStoredSettings(storage);
    setGithubToken(stored.githubToken);
    setGithubLogin(stored.githubLogin);
    setR2Settings(stored.r2Settings ?? emptyR2Settings());
  }

  async function handleSaveGitHub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("github");
    setNotice(null);

    try {
      const storage = requireLocalStorage();
      const user = await validateGitHubToken(githubToken);
      await saveGitHubCredentials(storage, githubToken, user.login);
      setGithubLogin(user.login);
      setNotice({
        kind: "success",
        message: `Saved GitHub token for @${user.login}.`
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message: getSettingsErrorMessage(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClearGitHub() {
    setBusyAction("clear-github");
    setNotice(null);

    try {
      await clearGitHubCredentials(requireLocalStorage());
      setGithubToken("");
      setGithubLogin("");
      setNotice({ kind: "success", message: "GitHub credentials cleared." });
    } catch (error) {
      setNotice({
        kind: "error",
        message: getSettingsErrorMessage(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveR2(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("r2");
    setNotice(null);

    try {
      const normalized = await saveR2Settings(
        requireLocalStorage(),
        r2Settings
      );
      setR2Settings(normalized);
      setNotice({ kind: "success", message: "R2 settings saved locally." });
    } catch (error) {
      setNotice({
        kind: "error",
        message: getSettingsErrorMessage(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClearR2() {
    setBusyAction("clear-r2");
    setNotice(null);

    try {
      await clearR2Settings(requireLocalStorage());
      setR2Settings(emptyR2Settings());
      setR2Json("");
      setNotice({ kind: "success", message: "R2 settings cleared." });
    } catch (error) {
      setNotice({
        kind: "error",
        message: getSettingsErrorMessage(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  function handleExportR2() {
    try {
      setR2Json(buildR2SettingsExport(r2Settings));
      setNotice({
        kind: "success",
        message: "R2 JSON export is ready."
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message: getSettingsErrorMessage(error)
      });
    }
  }

  async function handleImportR2() {
    setBusyAction("import");
    setNotice(null);

    try {
      const imported = parseR2SettingsImport(r2Json);
      const saved = await saveR2Settings(requireLocalStorage(), imported);
      setR2Settings(saved);
      setNotice({ kind: "success", message: "R2 settings imported locally." });
    } catch (error) {
      setNotice({
        kind: "error",
        message: getSettingsErrorMessage(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  function updateR2Field<Key extends keyof R2Settings>(
    key: Key,
    value: R2Settings[Key]
  ) {
    setR2Settings((current) => ({
      ...current,
      [key]: value
    }));
  }

  const githubConfigured = githubLogin.length > 0;
  const r2Configured = Object.values(r2Settings).every((value) => value.length > 0);

  return (
    <main className="options-shell">
      <header className="options-header">
        <p className="eyebrow">SnapIssue</p>
        <h1>Settings</h1>
      </header>

      {notice ? (
        <p className="notice" data-kind={notice.kind} role="status">
          {notice.message}
        </p>
      ) : null}

      <form className="settings-panel" onSubmit={(event) => void handleSaveGitHub(event)}>
        <div className="section-heading">
          <div>
            <h2>GitHub</h2>
            <p>Fine-grained PATs are stored in local extension storage.</p>
          </div>
          <span className="status-badge" data-ready={githubConfigured}>
            {githubConfigured ? `@${githubLogin}` : "Not configured"}
          </span>
        </div>

        <label className="field">
          <span>Token</span>
          <input
            autoComplete="off"
            inputMode="text"
            onChange={(event) => setGithubToken(event.target.value)}
            placeholder="Fine-grained PAT"
            type="password"
            value={githubToken}
          />
        </label>

        <div className="button-row">
          <button className="primary-action" disabled={busyAction === "github"} type="submit">
            {busyAction === "github" ? "Validating" : "Save GitHub Token"}
          </button>
          <button
            disabled={busyAction === "clear-github" || !githubToken}
            onClick={() => void handleClearGitHub()}
            type="button"
          >
            Clear
          </button>
        </div>
      </form>

      <form className="settings-panel" onSubmit={(event) => void handleSaveR2(event)}>
        <div className="section-heading">
          <div>
            <h2>Cloudflare R2</h2>
            <p>Screenshots uploaded through R2 are public by link.</p>
          </div>
          <span className="status-badge" data-ready={r2Configured}>
            {r2Configured ? "Configured" : "Not configured"}
          </span>
        </div>

        <div className="warning-block">
          R2 imports can contain upload credentials. Only import JSON from a source you trust.
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Account ID</span>
            <input
              autoComplete="off"
              onChange={(event) => updateR2Field("accountId", event.target.value)}
              value={r2Settings.accountId}
            />
          </label>
          <label className="field">
            <span>Bucket</span>
            <input
              autoComplete="off"
              onChange={(event) => updateR2Field("bucketName", event.target.value)}
              value={r2Settings.bucketName}
            />
          </label>
          <label className="field">
            <span>Access key ID</span>
            <input
              autoComplete="off"
              onChange={(event) => updateR2Field("accessKeyId", event.target.value)}
              value={r2Settings.accessKeyId}
            />
          </label>
          <label className="field">
            <span>Secret access key</span>
            <input
              autoComplete="off"
              onChange={(event) =>
                updateR2Field("secretAccessKey", event.target.value)
              }
              type="password"
              value={r2Settings.secretAccessKey}
            />
          </label>
          <label className="field field-wide">
            <span>Public base URL</span>
            <input
              autoComplete="off"
              onChange={(event) =>
                updateR2Field("publicBaseUrl", event.target.value)
              }
              placeholder="https://assets.example.com"
              type="url"
              value={r2Settings.publicBaseUrl}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="primary-action" disabled={busyAction === "r2"} type="submit">
            {busyAction === "r2" ? "Saving" : "Save R2 Settings"}
          </button>
          <button onClick={handleExportR2} type="button">
            Export JSON
          </button>
          <button
            disabled={busyAction === "clear-r2" || !r2Configured}
            onClick={() => void handleClearR2()}
            type="button"
          >
            Clear
          </button>
        </div>

        <label className="field">
          <span>R2 import / export JSON</span>
          <textarea
            onChange={(event) => setR2Json(event.target.value)}
            spellCheck={false}
            value={r2Json}
          />
        </label>
        <div className="button-row compact-row">
          <button
            disabled={busyAction === "import" || r2Json.trim().length === 0}
            onClick={() => void handleImportR2()}
            type="button"
          >
            {busyAction === "import" ? "Importing" : "Import JSON"}
          </button>
        </div>
      </form>
    </main>
  );
}

function getLocalStorage(): LocalSettingsStorage | null {
  return globalThis.chrome?.storage?.local ?? null;
}

function requireLocalStorage(): LocalSettingsStorage {
  const storage = getLocalStorage();
  if (!storage) {
    throw new Error("Extension local storage is unavailable.");
  }
  return storage;
}

function getSettingsErrorMessage(error: unknown): string {
  if (error instanceof GitHubValidationError || error instanceof R2SettingsError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Settings could not be saved.";
}
