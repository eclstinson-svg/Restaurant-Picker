import { Picker } from "@/components/Picker";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Where should we eat?</h1>
        <p className="mt-1 text-muted">Set the vibe, then let fate decide.</p>
      </header>
      <Picker />
    </main>
  );
}
