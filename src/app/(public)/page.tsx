import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <p className="text-sm tracking-wide text-muted-foreground uppercase">Seelenzeit</p>
      <h1 className="text-3xl leading-tight font-semibold sm:text-4xl">Schön, dass du da bist.</h1>
      <p className="text-lg text-muted-foreground">
        Hier entsteht gerade ein Ort für deine Selbstlernkurse – in deinem Tempo, ohne Abo, mit Zeit
        für dich.
      </p>
      <div>
        <Button size="lg" disabled>
          Bald geht&apos;s los
        </Button>
      </div>
    </main>
  );
}
