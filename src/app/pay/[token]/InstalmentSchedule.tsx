type Instalment = {
  id: string;
  label: string;
  amount_pence: number;
  due_date: string;
  sort_order: number;
};

export default function InstalmentSchedule({ instalments }: { instalments: Instalment[] }) {
  if (!instalments.length) return null;

  const total = instalments.reduce((s, i) => s + i.amount_pence, 0);

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-blue-900">Payment schedule</h2>
      <div className="space-y-2">
        {instalments.map((inst) => {
          const date = new Date(inst.due_date).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
          });
          return (
            <div key={inst.id} className="flex justify-between text-sm">
              <div>
                <span className="font-medium text-blue-900">{inst.label}</span>
                <span className="text-blue-600 ml-2 text-xs">due {date}</span>
              </div>
              <span className="font-mono font-medium text-blue-900">
                £{(inst.amount_pence / 100).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-blue-200 pt-2 flex justify-between text-xs text-blue-600">
        <span>Total</span>
        <span className="font-mono font-semibold">£{(total / 100).toFixed(2)}</span>
      </div>
      <p className="text-xs text-blue-500">
        You can pay each instalment separately or pay in full at any time.
      </p>
    </div>
  );
}
