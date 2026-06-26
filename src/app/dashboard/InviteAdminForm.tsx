"use client";

import { useState, useTransition, useRef } from "react";
import { inviteAdmin } from "./actions";

export default function InviteAdminForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await inviteAdmin(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Invite sent — they'll receive an email to set up their account.");
        formRef.current?.reset();
      }
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">Admin users</h2>
      <p className="text-sm text-gray-500">
        Invite a colleague to manage payments for this school.
      </p>
      <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="colleague@school.org"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Invite"}
        </button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {success && <p role="status" className="text-sm text-green-700">{success}</p>}
    </div>
  );
}
