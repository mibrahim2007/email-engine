/**
 * Placeholder landing page. The `(marketing)` route group is public and
 * statically generated (Architecture §9.1, §9.4).
 *
 * `(app)` and `(auth)` are deliberately absent — both need Clerk, which
 * arrives in Story 1.4. Scaffolding empty guarded routes now would create
 * pages that look protected and are not.
 */
export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Email Engine</h1>
      <p className="text-[color:var(--color-muted-foreground)]">
        Connect a shared mailbox and an AI agent drafts source-cited replies
        that a human reviews — or that send themselves above a confidence
        threshold you control.
      </p>
      <p className="text-sm text-[color:var(--color-muted-foreground)]">
        Deployment skeleton only. See <code>/api/health</code>.
      </p>
    </main>
  );
}
