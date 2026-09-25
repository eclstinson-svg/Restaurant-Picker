import { App } from "@/components/App";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Where should we eat?</h1>
        <p className="mt-1 text-muted">Set a few filters and let us pick a place.</p>
      </header>
      <App />
    </main>
  );
}
