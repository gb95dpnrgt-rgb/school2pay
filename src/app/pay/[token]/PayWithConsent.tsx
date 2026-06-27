"use client";

import { useState } from "react";
import PaymentSelector from "./PaymentSelector";
import ConsentForm, { type ConsentFormData } from "./ConsentForm";

type Assignment = {
  id: string;
  amount_due_pence: number;
  amount_paid_pence: number;
  status: string;
  students: { first_name: string; year_group: string };
};

interface Props {
  assignments: Assignment[];
  guardianId: string;
  paymentRequestId: string;
  token: string;
  allowPartial: boolean;
  consentForms: ConsentFormData[];
  requiresConsentBeforePayment: boolean;
}

export default function PayWithConsent({
  assignments,
  guardianId,
  paymentRequestId,
  token,
  allowPartial,
  consentForms,
  requiresConsentBeforePayment,
}: Props) {
  const hasConsent = consentForms.length > 0;
  const allAlreadyConsented = consentForms.every(
    (f) => !!f.existingResponse?.signed_at && !f.existingResponse?.withdrawn_at
  );

  const [consentComplete, setConsentComplete] = useState(allAlreadyConsented);

  if (hasConsent && requiresConsentBeforePayment && !consentComplete) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
          You must complete the consent form before proceeding to payment.
        </div>
        <ConsentForm
          forms={consentForms}
          guardianId={guardianId}
          token={token}
          onAllConsented={() => setConsentComplete(true)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Consent form shown alongside payment when not gated */}
      {hasConsent && !consentComplete && (
        <ConsentForm
          forms={consentForms}
          guardianId={guardianId}
          token={token}
          onAllConsented={() => setConsentComplete(true)}
        />
      )}

      {hasConsent && consentComplete && !allAlreadyConsented && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Consent recorded — you can now proceed to payment.
        </div>
      )}

      <PaymentSelector
        assignments={assignments}
        guardianId={guardianId}
        paymentRequestId={paymentRequestId}
        token={token}
        allowPartial={allowPartial}
      />
    </div>
  );
}
