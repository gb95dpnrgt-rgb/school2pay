"use client";

import { useState, useTransition } from "react";
import { resendGuardianEmail } from "@/app/requests/new/actions";

export default function ResendEmailButton({
  guardianId,
  paymentRequestId,
}: {
  guardianId: string;
  paymentRequestId: string;
}) {
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await resendGuardianEmail(guardianId, paymentRequestId);
        setStatus("sent");
        setTimeout(() => setStatus("idle"), 4000);
      } catch {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 4000);
      }
    });
  }

  if (status === "sent") return <span className="text-xs text-green-600 font-medium">Sent ✓</span>;
  if (status === "error") return <span className="text-xs text-red-600 font-medium">Failed</span>;

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "Sending…" : "Resend email"}
    </button>
  );
}
