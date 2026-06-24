import { Show, SignIn } from "@clerk/nextjs";
import { MallaBuilder } from "@/components/MallaBuilder";
import data from "@/data/courses.json";
import type { CoursesData } from "@/lib/domain/types";

export default function Home() {
  return (
    <Show fallback={<SignedOutView />} when="signed-in">
      <MallaBuilder data={data as CoursesData} />
    </Show>
  );
}

function SignedOutView() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-auto bg-background p-6 text-foreground">
      <section className="flex w-full max-w-md flex-col items-center gap-5">
        <div className="w-full rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            UNMSM FISI
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
            Malla FISI
          </h1>
          <p className="mt-2 text-sm leading-snug text-muted-foreground">
            Ingresa para crear y guardar tus propias versiones de malla curricular.
          </p>
        </div>
        <SignIn
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-sm",
            },
          }}
        />
      </section>
    </main>
  );
}
