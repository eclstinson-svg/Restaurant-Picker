import { App } from "@/components/App";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <span aria-hidden="true">🎲</span> Dinner Dice
        </h1>
        <p className="mt-1 text-muted">Roll for tonight&rsquo;s table.</p>
      </header>
      <App />
    </main>
  );
}
