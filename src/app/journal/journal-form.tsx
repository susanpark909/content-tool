"use client";

import { useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createJournalEntry } from "./actions";

export function JournalForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          await createJournalEntry(formData);
          formRef.current?.reset();
        });
      }}
      className="flex flex-col gap-3"
    >
      <Textarea
        name="content"
        placeholder="What's the idea?"
        rows={6}
        required
        disabled={isPending}
      />
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Save entry"}
      </Button>
    </form>
  );
}
