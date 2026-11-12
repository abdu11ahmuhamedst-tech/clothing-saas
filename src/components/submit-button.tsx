"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="button disabled:cursor-wait disabled:opacity-60">
    {pending ? pendingLabel : label}
  </button>;
}
