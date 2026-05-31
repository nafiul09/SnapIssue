export function OptionsApp() {
  return (
    <main className="options-shell">
      <header className="options-header">
        <p className="eyebrow">SnapIssue</p>
        <h1>Settings</h1>
      </header>

      <section className="settings-panel" aria-labelledby="github-heading">
        <div>
          <h2 id="github-heading">GitHub</h2>
          <p>Personal token validation and repo access controls are next.</p>
        </div>
        <span className="status-badge">Not configured</span>
      </section>

      <section className="settings-panel" aria-labelledby="r2-heading">
        <div>
          <h2 id="r2-heading">Cloudflare R2</h2>
          <p>Bucket settings stay local and are never bundled into builds.</p>
        </div>
        <span className="status-badge">Not configured</span>
      </section>
    </main>
  );
}
