import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  GitHubValidationError,
  createGitHubLabel,
  listAccessibleRepos,
  listGitHubLabels,
  type GitHubLabel,
  validateGitHubToken
} from "../shared/githubClient";
import { generateLabelColor } from "../shared/labelColor";
import {
  buildRepoCatalog,
  findRepoInCatalog,
  type RepoCatalogCache,
  type RepoCatalogEntry
} from "../shared/repoCatalog";
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
  saveSensitiveDomainPatterns,
  type LocalSettingsStorage
} from "../shared/settingsStorage";
import {
  DEFAULT_SENSITIVE_DOMAIN_PATTERNS,
  formatSensitiveDomainText,
  parseSensitiveDomainText
} from "../shared/sensitiveDomains";
import {
  loadLabelsForRepo,
  loadRepoCatalog,
  saveLabelsForRepo,
  saveRepoCatalog,
  sortLabels
} from "../shared/targetingStorage";

type Notice = {
  kind: "success" | "error";
  message: string;
} | null;

type BusyAction =
  | "github"
  | "r2"
  | "import"
  | "clear-github"
  | "clear-r2"
  | "repos"
  | "labels"
  | "create-label"
  | "privacy"
  | null;

export function OptionsApp() {
  const [githubToken, setGithubToken] = useState("");
  const [githubLogin, setGithubLogin] = useState("");
  const [r2Settings, setR2Settings] = useState<R2Settings>(() =>
    emptyR2Settings()
  );
  const [r2Json, setR2Json] = useState("");
  const [repoCatalog, setRepoCatalog] = useState<RepoCatalogCache | null>(null);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedRepoFullName, setSelectedRepoFullName] = useState("");
  const [labels, setLabels] = useState<GitHubLabel[]>([]);
  const [selectedLabelNames, setSelectedLabelNames] = useState<string[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [sensitiveDomainText, setSensitiveDomainText] = useState(() =>
    formatSensitiveDomainText([...DEFAULT_SENSITIVE_DOMAIN_PATTERNS])
  );
  const [notice, setNotice] = useState<Notice>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  const selectedOwnerGroup = useMemo(
    () => repoCatalog?.owners.find((group) => group.owner === selectedOwner) ?? null,
    [repoCatalog, selectedOwner]
  );
  const selectedRepo = useMemo(
    () => findRepoInCatalog(repoCatalog, selectedRepoFullName),
    [repoCatalog, selectedRepoFullName]
  );

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
    setSensitiveDomainText(formatSensitiveDomainText(stored.sensitiveDomainPatterns));

    const cachedCatalog = await loadRepoCatalog(storage);
    setRepoCatalog(cachedCatalog);
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

  async function handleRefreshRepos() {
    setBusyAction("repos");
    setNotice(null);

    try {
      const storage = requireLocalStorage();
      const repos = await listAccessibleRepos(githubToken);
      const catalog = buildRepoCatalog(repos);
      await saveRepoCatalog(storage, catalog);
      setRepoCatalog(catalog);
      setSelectedOwner("");
      setSelectedRepoFullName("");
      setLabels([]);
      setSelectedLabelNames([]);
      setNotice({
        kind: "success",
        message: `Repo access refreshed: ${countCatalogRepos(catalog)} eligible repos.`
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

  async function handleSelectOwner(owner: string) {
    setSelectedOwner(owner);
    setSelectedRepoFullName("");
    setLabels([]);
    setSelectedLabelNames([]);
  }

  async function handleSelectRepo(repo: RepoCatalogEntry) {
    setSelectedOwner(repo.owner);
    setSelectedRepoFullName(repo.fullName);
    setSelectedLabelNames([]);
    await refreshLabels(repo);
  }

  async function refreshLabels(repo: RepoCatalogEntry | null = selectedRepo) {
    if (!repo) {
      return;
    }

    setBusyAction("labels");
    setNotice(null);

    try {
      const storage = requireLocalStorage();
      const cachedLabels = await loadLabelsForRepo(storage, repo.owner, repo.name);
      if (cachedLabels.length > 0) {
        setLabels(sortLabels(cachedLabels));
      }

      const fetchedLabels = await listGitHubLabels(githubToken, repo.owner, repo.name);
      const sortedLabels = sortLabels(fetchedLabels);
      await saveLabelsForRepo(storage, repo.owner, repo.name, sortedLabels);
      setLabels(sortedLabels);
      setNotice({
        kind: "success",
        message: `Loaded ${sortedLabels.length} labels for ${repo.fullName}.`
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

  async function handleCreateLabel() {
    if (!selectedRepo) {
      setNotice({ kind: "error", message: "Select a repo before creating labels." });
      return;
    }

    setBusyAction("create-label");
    setNotice(null);

    try {
      const labelName = newLabelName.trim();
      const color = generateLabelColor(labelName);
      const createdLabel = await createGitHubLabel(
        githubToken,
        selectedRepo.owner,
        selectedRepo.name,
        labelName,
        color
      );
      const nextLabels = sortLabels([
        ...labels.filter((label) => label.name !== createdLabel.name),
        createdLabel
      ]);
      await saveLabelsForRepo(
        requireLocalStorage(),
        selectedRepo.owner,
        selectedRepo.name,
        nextLabels
      );
      setLabels(nextLabels);
      setSelectedLabelNames((current) =>
        current.includes(createdLabel.name) ? current : [...current, createdLabel.name]
      );
      setNewLabelName("");
      setNotice({
        kind: "success",
        message: `Created label ${createdLabel.name}.`
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

  function toggleLabel(labelName: string) {
    setSelectedLabelNames((current) =>
      current.includes(labelName)
        ? current.filter((name) => name !== labelName)
        : [...current, labelName]
    );
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

  async function handleSavePrivacy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("privacy");
    setNotice(null);

    try {
      const saved = await saveSensitiveDomainPatterns(
        requireLocalStorage(),
        parseSensitiveDomainText(sensitiveDomainText)
      );
      setSensitiveDomainText(formatSensitiveDomainText(saved));
      setNotice({
        kind: "success",
        message: "Sensitive-domain warnings saved locally."
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

  async function handleResetPrivacyDefaults() {
    setBusyAction("privacy");
    setNotice(null);

    try {
      const saved = await saveSensitiveDomainPatterns(requireLocalStorage(), [
        ...DEFAULT_SENSITIVE_DOMAIN_PATTERNS
      ]);
      setSensitiveDomainText(formatSensitiveDomainText(saved));
      setNotice({
        kind: "success",
        message: "Sensitive-domain defaults restored."
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

      <section className="settings-panel" aria-labelledby="targeting-heading">
        <div className="section-heading">
          <div>
            <h2 id="targeting-heading">Targeting</h2>
            <p>Repo access is cached locally after a manual refresh.</p>
          </div>
          <span className="status-badge" data-ready={Boolean(selectedRepo)}>
            {selectedRepo ? selectedRepo.fullName : "No repo selected"}
          </span>
        </div>

        <div className="button-row">
          <button
            className="primary-action"
            disabled={busyAction === "repos" || githubToken.trim().length === 0}
            onClick={() => void handleRefreshRepos()}
            type="button"
          >
            {busyAction === "repos" ? "Refreshing" : "Refresh Repo Access"}
          </button>
          {repoCatalog ? (
            <span className="inline-meta">
              {countCatalogRepos(repoCatalog)} repos cached
            </span>
          ) : null}
        </div>

        <div className="target-grid">
          <SearchableDropdown
            emptyLabel="No owners found"
            items={(repoCatalog?.owners ?? []).map((group) => ({
              id: group.owner,
              label: group.owner,
              meta: `${group.repos.length} repos`,
              value: group
            }))}
            label="Owner"
            onSelect={(group) => void handleSelectOwner(group.owner)}
            placeholder="Search owners"
            selectedLabel={selectedOwner || "Choose owner"}
          />

          <SearchableDropdown
            emptyLabel={selectedOwner ? "No repos found" : "Choose an owner first"}
            items={(selectedOwnerGroup?.repos ?? []).map((repo) => ({
              id: repo.fullName,
              label: repo.name,
              meta: repo.private ? "Private" : "Public",
              icon: <VisibilityIcon privateRepo={repo.private} />,
              value: repo
            }))}
            label="Repo"
            onSelect={(repo) => void handleSelectRepo(repo)}
            placeholder="Search repos"
            selectedLabel={selectedRepo?.name ?? "Choose repo"}
          />
        </div>

        <div className="label-manager">
          <div className="section-heading compact-heading">
            <div>
              <h3>Labels</h3>
              <p>
                {selectedLabelNames.length > 0
                  ? `${selectedLabelNames.length} selected`
                  : "No labels selected"}
              </p>
            </div>
            <button
              disabled={!selectedRepo || busyAction === "labels"}
              onClick={() => void refreshLabels()}
              type="button"
            >
              {busyAction === "labels" ? "Loading" : "Refresh Labels"}
            </button>
          </div>

          <div className="label-list" aria-label="Labels">
            {labels.length > 0 ? (
              labels.map((label) => (
                <button
                  className="label-chip"
                  data-selected={selectedLabelNames.includes(label.name)}
                  key={label.id}
                  onClick={() => toggleLabel(label.name)}
                  type="button"
                >
                  <span
                    className="label-swatch"
                    style={{ backgroundColor: `#${label.color}` }}
                  />
                  {label.name}
                </button>
              ))
            ) : (
              <span className="empty-state">
                {selectedRepo ? "No labels loaded" : "Choose a repo to load labels"}
              </span>
            )}
          </div>

          <div className="create-label-row">
            <label className="field">
              <span>Missing label</span>
              <input
                autoComplete="off"
                onChange={(event) => setNewLabelName(event.target.value)}
                placeholder="Label name"
                value={newLabelName}
              />
            </label>
            <button
              disabled={
                !selectedRepo ||
                newLabelName.trim().length === 0 ||
                busyAction === "create-label"
              }
              onClick={() => void handleCreateLabel()}
              type="button"
            >
              {busyAction === "create-label" ? "Creating" : "Create Label"}
            </button>
          </div>
        </div>
      </section>

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

      <form className="settings-panel" onSubmit={(event) => void handleSavePrivacy(event)}>
        <div className="section-heading">
          <div>
            <h2>Privacy Warnings</h2>
            <p>Matching domains show a confirmation before screenshot upload.</p>
          </div>
          <span className="status-badge" data-ready="true">
            Local
          </span>
        </div>

        <div className="warning-block">
          R2 screenshots are public by link. These warnings are reminders, not blocks.
        </div>

        <label className="field">
          <span>Sensitive domains</span>
          <textarea
            className="compact-textarea"
            onChange={(event) => setSensitiveDomainText(event.target.value)}
            spellCheck={false}
            value={sensitiveDomainText}
          />
        </label>

        <div className="button-row">
          <button
            className="primary-action"
            disabled={busyAction === "privacy"}
            type="submit"
          >
            {busyAction === "privacy" ? "Saving" : "Save Warnings"}
          </button>
          <button
            disabled={busyAction === "privacy"}
            onClick={() => void handleResetPrivacyDefaults()}
            type="button"
          >
            Reset Defaults
          </button>
        </div>
      </form>
    </main>
  );
}

type SearchableItem<T> = {
  id: string;
  label: string;
  meta?: string;
  icon?: ReactNode;
  value: T;
};

type SearchableDropdownProps<T> = {
  label: string;
  placeholder: string;
  selectedLabel: string;
  emptyLabel: string;
  items: SearchableItem<T>[];
  onSelect: (value: T) => void;
};

function SearchableDropdown<T>({
  label,
  placeholder,
  selectedLabel,
  emptyLabel,
  items,
  onSelect
}: SearchableDropdownProps<T>) {
  const [query, setQuery] = useState("");
  const filteredItems = items.filter((item) =>
    `${item.label} ${item.meta ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="searchable-select">
      <label className="field">
        <span>{label}</span>
        <input
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          value={query}
        />
      </label>
      <div className="selected-value">{selectedLabel}</div>
      <div className="select-list" role="listbox" aria-label={label}>
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <button
              className="select-option"
              key={item.id}
              onClick={() => {
                onSelect(item.value);
                setQuery("");
              }}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
              {item.meta ? <small>{item.meta}</small> : null}
            </button>
          ))
        ) : (
          <span className="empty-state">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}

function VisibilityIcon({ privateRepo }: { privateRepo: boolean }) {
  return (
    <span
      aria-label={privateRepo ? "Private repo" : "Public repo"}
      className="visibility-icon"
      data-private={privateRepo}
      role="img"
    />
  );
}

function countCatalogRepos(catalog: RepoCatalogCache): number {
  return catalog.owners.reduce((total, owner) => total + owner.repos.length, 0);
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
