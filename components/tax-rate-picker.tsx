"use client"

import { useMemo, useState } from "react"

type TaxRate = {
  name: string
  rate: number
}

type Props = {
  value: string
  rate: number
  onChange: (name: string, rate: number) => void
}

const defaultRates: TaxRate[] = [
  { name: "Auburn", rate: 10.2 },
  { name: "Bremerton", rate: 9.2 },
  { name: "Des Moines", rate: 10.1 },
  { name: "Federal Way", rate: 10.3 },
  { name: "Fife", rate: 10.0 },
  { name: "Gig Harbor", rate: 8.1 },
  { name: "Graham", rate: 9.4 },
  { name: "Issaquah", rate: 10.5 },
  { name: "Kent", rate: 10.1 },
  { name: "Lakebay", rate: 8.1 },
  { name: "Lakewood", rate: 10.0 },
  { name: "Lynwood", rate: 10.6 },
  { name: "Marysville", rate: 9.4 },
  { name: "Parkland", rate: 9.4 },
  { name: "Port Orchard", rate: 9.3 },
  { name: "Puyallup", rate: 10.1 },
  { name: "Renton", rate: 10.1 },
  { name: "Seattle", rate: 10.25 },
  { name: "Silverdale", rate: 9.2 },
  { name: "Spanaway", rate: 10.0 },
  { name: "Steilacoom", rate: 10.1 },
  { name: "Tacoma", rate: 10.3 },
  { name: "Tukwila", rate: 10.1 },
  { name: "University Place", rate: 10.0 },
  { name: "Vashon Island", rate: 8.7 },
]

export default function TaxRatePicker({
  value,
  rate,
  onChange,
}: Props) {
  const [rates, setRates] = useState<TaxRate[]>(
    [...defaultRates].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  )

  const selectedRate = useMemo(() => {
    return rates.find((r) => r.name === value)
  }, [rates, value])

  const handleSelect = (name: string) => {
    const found = rates.find((r) => r.name === name)

    if (!found) return

    onChange(found.name, found.rate)
  }

  const updateRate = (name: string, newRate: number) => {
    const updated = rates.map((r) =>
      r.name === name
        ? { ...r, rate: newRate }
        : r
    )

    setRates(updated)

    if (value === name) {
      onChange(name, newRate)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#8b5e34] mb-1">
          Tax Area
        </label>

        <select
          value={value}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full rounded border border-[#c8a97e] bg-[#f7f2ea] px-3 py-2"
        >
          <option value="">Select Tax Area</option>

          {rates.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name} ({item.rate}%)
            </option>
          ))}
        </select>
      </div>

      {selectedRate && (
        <div className="rounded border border-[#d6c2a8] bg-[#f5efe6] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#3d2d1f]">
                {selectedRate.name}
              </div>

              <div className="text-xs text-[#8b5e34]">
                Current Rate
              </div>
            </div>

            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) =>
                updateRate(
                  selectedRate.name,
                  Number(e.target.value)
                )
              }
              className="w-28 rounded border border-[#c8a97e] bg-white px-3 py-2 text-right"
            />
          </div>
        </div>
      )}
    </div>
  )
}