export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
        <p className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-sky-300">
          NEXUS KB PHASE 0
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Backend-first reset in progress
        </h1>
        <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
          This web app has been intentionally reduced to a minimal shell while the new job engine and
          ingestion pipeline are rebuilt.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium hover:border-sky-400 hover:text-sky-200"
            href="http://localhost:3000/api/v1/healthz"
            target="_blank"
            rel="noreferrer"
          >
            API Health
          </a>
          <a
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium hover:border-sky-400 hover:text-sky-200"
            href="http://localhost:3000/api/v1/version"
            target="_blank"
            rel="noreferrer"
          >
            API Version
          </a>
        </div>
      </section>
    </main>
  );
}
