"use client";

import { useState } from "react";
import { createShopItem, toggleShopItem, fulfillOrder } from "./actions";
import type { ShopItem, ShopOrder } from "./page";

function pence(n: number) { return `£${(n / 100).toFixed(2)}`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }

const STATUS_COLOURS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-blue-100 text-blue-700",
  fulfilled: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  refunded: "bg-red-100 text-red-700",
};

// ── Add item form ─────────────────────────────────────────────────────────────

function AddItemForm({ onDone }: { onDone: () => void }) {
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await createShopItem(new FormData(e.currentTarget));
    setPending(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Item name *</label>
          <input name="name" required placeholder="e.g. School jumper"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea name="description" rows={2} placeholder="Optional — sizes, colours, etc."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Price (£) *</label>
          <input name="price" type="number" min="0.50" step="0.01" required placeholder="e.g. 12.50"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Stock quantity</label>
          <input name="stock" type="number" min="0" placeholder="Leave blank = unlimited"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onDone}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={pending}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
          {pending ? "Adding…" : "Add item"}
        </button>
      </div>
    </form>
  );
}

// ── Items tab ─────────────────────────────────────────────────────────────────

function ItemsTab({ items, schoolId }: { items: ShopItem[]; schoolId: string }) {
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function toggle(item: ShopItem) {
    setToggling(item.id);
    const fd = new FormData();
    fd.append("id", item.id);
    fd.append("active", String(item.active));
    await toggleShopItem(fd);
    setToggling(null);
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://school2pay.vercel.app";

  return (
    <div className="space-y-5">
      {adding ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">New item</h2>
          <AddItemForm onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          + Add item
        </button>
      )}

      {items.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-sm text-gray-500">No items yet — add your first shop item above.</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.id} className={`hover:bg-gray-50 ${!item.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{pence(item.price_pence)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {item.stock === null ? "Unlimited" : item.stock === 0 ? <span className="text-red-500">Out of stock</span> : item.stock}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {item.active ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(item)} disabled={toggling === item.id}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-40">
                    {toggling === item.id ? "…" : item.active ? "Hide" : "Show"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          Share the shop link with parents: <strong>/shop/browse/{schoolId}</strong> — or use the parent portal link below
        </div>
      )}
    </div>
  );
}

// ── Orders tab ────────────────────────────────────────────────────────────────

function OrdersTab({ orders }: { orders: ShopOrder[] }) {
  const [fulfilling, setFulfilling] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("paid");

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  async function doFulfil(orderId: string) {
    setFulfilling(orderId);
    const fd = new FormData();
    fd.append("order_id", orderId);
    await fulfillOrder(fd);
    setFulfilling(null);
  }

  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "paid", "fulfilled", "pending", "refunded"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === s ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {counts[s] ? ` (${counts[s]})` : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-400">No {filter === "all" ? "" : filter} orders yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((order) => (
          <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[order.status] ?? ""}`}>
                    {order.status}
                  </span>
                  <span className="text-xs text-gray-400">{fmtDate(order.created_at)}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 mt-1">{order.guardian.email}</p>
                {order.student && (
                  <p className="text-xs text-gray-500">for {order.student.first_name} ({order.student.year_group})</p>
                )}
              </div>
              <p className="font-bold text-gray-900 shrink-0">{pence(order.total_pence)}</p>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-1">
              {order.lines.map((line, i) => (
                <div key={i} className="flex justify-between text-sm text-gray-600">
                  <span>{line.item.name} × {line.quantity}</span>
                  <span>{pence(line.unit_price_pence * line.quantity)}</span>
                </div>
              ))}
            </div>

            {order.status === "paid" && (
              <button onClick={() => doFulfil(order.id)} disabled={fulfilling === order.id}
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40">
                {fulfilling === order.id ? "…" : "Mark as fulfilled (item given to pupil)"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = ["Items", "Orders"] as const;

export default function ShopClient({ items, orders, schoolId }: { items: ShopItem[]; orders: ShopOrder[]; schoolId: string }) {
  const [tab, setTab] = useState<"Items" | "Orders">("Items");
  const paidOrders = orders.filter((o) => o.status === "paid").length;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t}
            {t === "Orders" && paidOrders > 0 && (
              <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{paidOrders} to fulfil</span>
            )}
          </button>
        ))}
      </div>
      {tab === "Items" && <ItemsTab items={items} schoolId={schoolId} />}
      {tab === "Orders" && <OrdersTab orders={orders} />}
    </div>
  );
}
