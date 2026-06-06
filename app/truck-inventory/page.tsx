"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type InventoryCategory =
  | "Tools"
  | "Materials"
  | "Hardware"
  | "Safety"
  | "Cleaning"
  | "Equipment"
  | "Misc";

type TruckInventoryItem = {
  id: string;
  truckName: string;
  category: InventoryCategory;
  itemName: string;
  quantity: number;
  minimumQuantity: number;
  location: string;
  reorderNeeded: boolean;
  notes: string;
};

const categories: InventoryCategory[] = [
  "Tools",
  "Materials",
  "Hardware",
  "Safety",
  "Cleaning",
  "Equipment",
  "Misc",
];

const blankItem: Omit<TruckInventoryItem, "id"> = {
  truckName: "Main Truck",
  category: "Tools",
  itemName: "",
  quantity: 0,
  minimumQuantity: 0,
  location: "",
  reorderNeeded: false,
  notes: "",
};

function moneySafeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function TruckInventoryPage() {
  const [items, setItems] = useState<TruckInventoryItem[]>([]);
  const [form, setForm] = useState<Omit<TruckInventoryItem, "id">>(blankItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterTruck, setFilterTruck] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [search, setSearch] = useState("");

  const truckNames = useMemo(() => {
    const names = Array.from(new Set(items.map((item) => item.truckName).filter(Boolean)));
    return names.length ? names : ["Main Truck"];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesTruck = filterTruck === "All" || item.truckName === filterTruck;
      const matchesCategory = filterCategory === "All" || item.category === filterCategory;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.itemName.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q);

      return matchesTruck && matchesCategory && matchesSearch;
    });
  }, [items, filterTruck, filterCategory, search]);

  const totals = useMemo(() => {
    const lowStock = items.filter((item) => item.quantity <= item.minimumQuantity).length;
    const reorder = items.filter(
      (item) => item.reorderNeeded || item.quantity <= item.minimumQuantity
    ).length;

    return {
      totalItems: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      lowStock,
      reorder,
    };
  }, [items]);

  function resetForm() {
    setForm(blankItem);
    setEditingId(null);
  }

  function saveItem() {
    if (!form.itemName.trim()) return;

    const cleanItem: Omit<TruckInventoryItem, "id"> = {
      ...form,
      itemName: form.itemName.trim(),
      truckName: form.truckName.trim() || "Main Truck",
      location: form.location.trim(),
      notes: form.notes.trim(),
      reorderNeeded: form.reorderNeeded || form.quantity <= form.minimumQuantity,
    };

    if (editingId) {
      setItems((current) =>
        current.map((item) => (item.id === editingId ? { ...cleanItem, id: editingId } : item))
      );
    } else {
      setItems((current) => [{ ...cleanItem, id: crypto.randomUUID() }, ...current]);
    }

    resetForm();
  }

  function editItem(item: TruckInventoryItem) {
    setEditingId(item.id);
    setForm({
      truckName: item.truckName,
      category: item.category,
      itemName: item.itemName,
      quantity: item.quantity,
      minimumQuantity: item.minimumQuantity,
      location: item.location,
      reorderNeeded: item.reorderNeeded,
      notes: item.notes,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    if (editingId === id) resetForm();
  }

  function saveLocal() {
    localStorage.setItem("truckInventoryItems", JSON.stringify(items));
  }

  function loadLocal() {
    const raw = localStorage.getItem("truckInventoryItems");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as TruckInventoryItem[];
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      alert("Could not load saved truck inventory.");
    }
  }

  function clearLocal() {
    localStorage.removeItem("truckInventoryItems");
  }

  return (
    <main className="min-h-screen bg-[#f3f4f6] text-[#111827]">
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-card {
            box-shadow: none !important;
            border: 1px solid #d1d5db !important;
          }

          main {
            background: white !important;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      <section className="bg-[#0f172a] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#c9a227]">
              5 Tools / Operations
            </p>
            <h1 className="mt-2 text-3xl font-bold">Truck Inventory</h1>
            <p className="mt-1 text-sm text-slate-300">
              Track tools, materials, hardware, safety items, and reorder needs by truck.
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl border border-slate-500 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={() => window.print()}
              className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#d7b53a]"
            >
              Print Inventory
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Total Line Items</p>
            <p className="mt-2 text-3xl font-bold">{totals.totalItems}</p>
          </div>

          <div className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Total Quantity</p>
            <p className="mt-2 text-3xl font-bold">{totals.totalQuantity}</p>
          </div>

          <div className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Low Stock</p>
            <p className="mt-2 text-3xl font-bold text-orange-700">{totals.lowStock}</p>
          </div>

          <div className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Reorder Needed</p>
            <p className="mt-2 text-3xl font-bold text-red-700">{totals.reorder}</p>
          </div>
        </div>

        <div className="no-print mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">{editingId ? "Edit Inventory Item" : "Add Inventory Item"}</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Truck / Vehicle</span>
              <input
                value={form.truckName}
                onChange={(e) => setForm({ ...form, truckName: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Main Truck"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Category</span>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as InventoryCategory })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Item Name</span>
              <input
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Example: 2x4 studs, impact driver, outlet boxes"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Quantity</span>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: moneySafeNumber(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Minimum Qty</span>
              <input
                type="number"
                value={form.minimumQuantity}
                onChange={(e) =>
                  setForm({ ...form, minimumQuantity: moneySafeNumber(e.target.value) })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Location on Truck</span>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Example: Driver side bin, rear shelf, cab"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input
                type="checkbox"
                checked={form.reorderNeeded}
                onChange={(e) => setForm({ ...form, reorderNeeded: e.target.checked })}
              />
              <span className="text-sm font-semibold text-slate-700">Mark reorder needed</span>
            </label>

            <label className="block md:col-span-3">
              <span className="text-sm font-semibold text-slate-700">Notes</span>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Optional notes"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={saveItem}
              className="rounded-xl bg-[#0f172a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e293b]"
            >
              {editingId ? "Update Item" : "Add Item"}
            </button>

            <button
              onClick={resetForm}
              className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Clear
            </button>

            <button
              onClick={saveLocal}
              className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Save Local
            </button>

            <button
              onClick={loadLocal}
              className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Load Local
            </button>

            <button
              onClick={clearLocal}
              className="rounded-xl border border-red-300 px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Clear Local Save
            </button>
          </div>
        </div>

        <div className="no-print mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Filter Truck</span>
              <select
                value={filterTruck}
                onChange={(e) => setFilterTruck(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option>All</option>
                {truckNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Filter Category</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option>All</option>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Search item, location, or notes"
              />
            </label>
          </div>
        </div>

        <div className="print-card mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-xl font-bold">Inventory List</h2>
            <p className="text-sm text-slate-500">
              Showing {filteredItems.length} of {items.length} item(s)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-bold">Truck</th>
                  <th className="px-4 py-3 font-bold">Category</th>
                  <th className="px-4 py-3 font-bold">Item</th>
                  <th className="px-4 py-3 font-bold">Qty</th>
                  <th className="px-4 py-3 font-bold">Min</th>
                  <th className="px-4 py-3 font-bold">Location</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Notes</th>
                  <th className="no-print px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No inventory items added yet.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLow = item.quantity <= item.minimumQuantity;
                    const needsReorder = item.reorderNeeded || isLow;

                    return (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">{item.truckName}</td>
                        <td className="px-4 py-3">{item.category}</td>
                        <td className="px-4 py-3 font-semibold">{item.itemName}</td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3">{item.minimumQuantity}</td>
                        <td className="px-4 py-3">{item.location || "—"}</td>
                        <td className="px-4 py-3">
                          {needsReorder ? (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                              Reorder
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                              Stocked
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{item.notes || "—"}</td>
                        <td className="no-print px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => editItem(item)}
                              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}