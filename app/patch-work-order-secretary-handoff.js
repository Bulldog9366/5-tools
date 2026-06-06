const fs = require("fs")
const path = require("path")

const filePath = path.join(
  process.cwd(),
  "app",
  "work-order-engine",
  "page.tsx"
)

if (!fs.existsSync(filePath)) {
  console.log("Could not find app/work-order-engine/page.tsx")
  process.exit(1)
}

let content = fs.readFileSync(filePath, "utf8")

if (content.includes("workOrderDraft")) {
  console.log("Patch already appears installed.")
  process.exit(0)
}

const insertBlock = `
useEffect(() => {
  const savedDraft = localStorage.getItem("workOrderDraft")

  if (!savedDraft) return

  try {
    const parsed = JSON.parse(savedDraft)

    if (typeof setTitle === "function") {
      setTitle(parsed.title || "")
    }

    if (typeof setDescription === "function") {
      setDescription(parsed.details || "")
    }

    if (typeof setPropertyAddress === "function") {
      setPropertyAddress(parsed.property_address || "")
    }

    if (typeof setContactName === "function") {
      setContactName(parsed.contact_name || "")
    }

    if (typeof setPriority === "function") {
      setPriority(parsed.priority || "Normal")
    }

    localStorage.removeItem("workOrderDraft")
  } catch (err) {
    console.error("Failed to load work order draft", err)
  }
}, [])

`

content = content.replace(
  /export default function[\s\S]*?\{/,
  (match) => match + "\n" + insertBlock
)

fs.writeFileSync(filePath, content)

console.log("Secretary handoff patch applied.")