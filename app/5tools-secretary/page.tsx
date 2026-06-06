'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type SecretaryItemType =
  | 'Reminder'
  | 'Call Log'
  | 'Work Order Draft'
  | 'Owner Follow-Up'
  | 'Vendor Callback'
  | 'Scheduled Visit'

type SecretaryStatus = 'Open' | 'Done'
type SecretaryPriority = 'Normal' | 'Urgent'

type SecretaryItem = {
  id: string
  type: SecretaryItemType
  title: string
  details: string
  status: SecretaryStatus
  priority: SecretaryPriority
  dueDate: string
  dueTime: string
  propertyAddress: string
  contactName: string
  createdAt: string
  updatedAt: string
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

type SpeechRecognitionEventLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string
      }
    }
  }
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
}


const STORAGE_KEY = 'five-tools-secretary-items-v2'
const LEGACY_STORAGE_KEY = 'five-tools-secretary-items-v1'
const WORK_ORDER_HANDOFF_KEY = 'five-tools-work-order-draft'
const WORK_ORDER_HANDOFF_QUEUE_KEY = 'five-tools-work-order-drafts'
const SCHEDULER_HANDOFF_KEY = 'five-tools-scheduler-draft'
const TASKS_NOTES_STORAGE_KEY = 'five-tools-tasks-notes-v1'

const SUPABASE_SQL = `create table if not exists secretary_items (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  details text,
  status text default 'Open',
  priority text default 'Normal',
  due_date date,
  due_time text,
  property_address text,
  contact_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`


function secretaryPriorityToTaskPriority(priority: SecretaryPriority): 'Normal' | 'Urgent' {
  return priority === 'Urgent' ? 'Urgent' : 'Normal'
}

function shouldSendSecretaryItemToTasks(item: SecretaryItem) {
  if (item.type !== 'Call Log') return true

  const haystack = `${item.title} ${item.details}`.toLowerCase()
  return Boolean(
    item.dueDate ||
      haystack.includes('follow') ||
      haystack.includes('callback') ||
      haystack.includes('tomorrow') ||
      haystack.includes('owner') ||
      haystack.includes('vendor') ||
      haystack.includes('contractor')
  )
}

function pushSecretaryItemToTasksNotes(item: SecretaryItem) {
  if (typeof window === 'undefined') return false
  if (!shouldSendSecretaryItemToTasks(item)) return false

  try {
    const raw = window.localStorage.getItem(TASKS_NOTES_STORAGE_KEY)
    const existing = raw ? JSON.parse(raw) : []
    const existingTasks = Array.isArray(existing) ? existing : []

    const alreadyExists = existingTasks.some((task: any) => task?.sourceId === item.id)
    if (alreadyExists) return false

    const notes = [
      item.details,
      item.contactName ? `Contact: ${item.contactName}` : '',
      item.propertyAddress ? `Property: ${item.propertyAddress}` : '',
      item.dueTime ? `Due time: ${item.dueTime}` : '',
      `Source: Virtual Secretary`,
    ]
      .filter(Boolean)
      .join('\n')

    const task = {
      id: Date.now(),
      title: item.title,
      notes,
      category: '5 Tools',
      priority: secretaryPriorityToTaskPriority(item.priority),
      status: item.status,
      dueDate: item.dueDate,
      createdAt: new Date().toLocaleString([], {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      updatedAt: new Date().toLocaleString([], {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      source: 'Virtual Secretary',
      sourceId: item.id,
    }

    window.localStorage.setItem(TASKS_NOTES_STORAGE_KEY, JSON.stringify([task, ...existingTasks]))
    return true
  } catch {
    return false
  }
}


function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return { url: '', key: '', error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.' }
  }

  return { url: url.replace(/\/$/, ''), key, error: '' }
}

async function supabaseRestRequest(path: string, options: RequestInit = {}) {
  const config = getSupabaseConfig()

  if (config.error) {
    return { data: null, error: { message: config.error } }
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(options.headers || {}),
      },
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) : null

    if (!response.ok) {
      return { data: null, error: { message: data?.message || data?.error_description || response.statusText } }
    }

    return { data, error: null }
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : 'Supabase request failed.' } }
  }
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) =>
    (Number(char) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(char) / 4)))).toString(16)
  )
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowIso() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

function nextWeekdayIso(targetDay: number) {
  const date = new Date()
  const currentDay = date.getDay()
  let diff = targetDay - currentDay
  if (diff <= 0) diff += 7
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

function formatDateLabel(value: string) {
  if (!value) return 'No due date'

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function inferDueDate(lower: string) {
  if (lower.includes('today')) return todayIso()
  if (lower.includes('tomorrow')) return tomorrowIso()
  if (lower.includes('monday')) return nextWeekdayIso(1)
  if (lower.includes('tuesday')) return nextWeekdayIso(2)
  if (lower.includes('wednesday')) return nextWeekdayIso(3)
  if (lower.includes('thursday')) return nextWeekdayIso(4)
  if (lower.includes('friday')) return nextWeekdayIso(5)
  if (lower.includes('saturday')) return nextWeekdayIso(6)
  if (lower.includes('sunday')) return nextWeekdayIso(0)
  return ''
}

function extractTime(command: string) {
  const match = command.match(/\b(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm)\b/i)
  if (!match) return ''

  const hour = match[1]
  const minutes = match[2] || '00'
  const period = match[3].toUpperCase()

  return `${hour}:${minutes} ${period}`
}

function hasPropertyAddress(command: string) {
  return /\b\d{2,6}\s+[A-Za-z0-9 .'-]+\s+(?:st|street|ave|avenue|rd|road|dr|drive|ct|court|ln|lane|pl|place|way|blvd|boulevard|hwy|highway|pkwy|parkway|terrace|ter)\b/i.test(command)
}

function hasPropertySchedulerSignal(lower: string) {
  return (
    hasPropertyAddress(lower) ||
    lower.includes('property') ||
    lower.includes('unit') ||
    lower.includes('tenant') ||
    lower.includes('vendor') ||
    lower.includes('maintenance') ||
    lower.includes('repair') ||
    lower.includes('estimate') ||
    lower.includes('inspection') ||
    lower.includes('walkthrough') ||
    lower.includes('walk through') ||
    lower.includes('access') ||
    lower.includes('work order')
  )
}

function extractAddress(command: string) {
  const normalized = command.replace(/\s+/g, ' ').trim()

  const fullAddress = normalized.match(/\b(\d{2,6}\s+[A-Za-z0-9 .'-]+?\s+(?:st|street|ave|avenue|rd|road|dr|drive|ct|court|ln|lane|pl|place|way|blvd|boulevard|hwy|highway|pkwy|parkway|terrace|ter)\b(?:\s+[NSEW])?(?:\s+[A-Za-z .'-]+)?(?:\s+[A-Z]{2})?(?:\s+\d{5})?)/i)
  if (fullAddress) return fullAddress[1].trim().replace(/[,.]$/, '')

  const addressMatch = normalized.match(/(?:at|for|address)\s+(.+?)(?:\s+(?:with|contact|owner|tenant|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|urgent|priority)\b|$)/i)
  if (!addressMatch) return ''

  const possible = addressMatch[1].trim().replace(/[,.]$/, '')
  if (/\boffice\b|\bcoffee\b|\blunch\b|\bdinner\b|\bmeeting\b/i.test(possible) && !hasPropertyAddress(possible)) return ''
  return possible
}

function extractContact(command: string) {
  const contactMatch = command.match(/(?:contact|call|owner|tenant|vendor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)
  if (!contactMatch) return ''
  return contactMatch[1].trim()
}

function toTitleCase(input: string) {
  if (!input) return input
  return input.charAt(0).toUpperCase() + input.slice(1)
}

function stripCommandPrefix(command: string) {
  return command
    .replace(/^add\s+/i, '')
    .replace(/^create\s+/i, '')
    .replace(/^new\s+/i, '')
    .replace(/^start\s+/i, '')
    .replace(/^schedule\s+/i, '')
    .replace(/^scheduled?\s+/i, '')
    .replace(/^appointment\s+/i, '')
    .replace(/^reminder\s*/i, '')
    .replace(/^remind me to\s*/i, '')
    .replace(/^work order\s*/i, '')
    .replace(/^call log\s*/i, '')
    .replace(/^log call\s*/i, '')
    .replace(/^call\s*/i, '')
    .replace(/^owner follow[- ]?up\s*/i, '')
    .replace(/^vendor callback\s*/i, '')
    .replace(/^visit\s*/i, '')
    .trim()
}

function removeDateTimeWords(text: string) {
  return text
    .replace(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(?:at\s*)?(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractIssue(command: string, address: string) {
  let text = stripCommandPrefix(command)
  text = text.replace(/^work order\s*/i, '')
  text = text.replace(/^visit\s*/i, '')
  text = text.replace(/^appointment\s*/i, '')
  if (address) text = text.replace(address, '')
  text = text.replace(/\b(?:at|for|to|on)\s*$/i, '')
  text = text.replace(/^\s*(?:at|for)\s+/i, '')
  text = text.replace(/^\s*[.,:;-]+\s*/, '')
  text = text.replace(/\s*[.,:;-]+\s*/g, ' ')
  text = removeDateTimeWords(text)
  return text.trim()
}

function buildReminderTitle(command: string) {
  let text = stripCommandPrefix(command)
  text = text.replace(/^appointment\s*/i, '')
  text = removeDateTimeWords(text)
  text = text.replace(/^for\s+/i, '')
  text = text.replace(/\s+/g, ' ').trim()

  if (/coffee/i.test(command) && /office/i.test(command)) return 'Coffee appointment at office'
  if (!text) return 'Reminder'
  return toTitleCase(text)
}

function cleanTitle(command: string) {
  return stripCommandPrefix(command)
}

function parseCommand(command: string): Pick<SecretaryItem, 'type' | 'title' | 'details' | 'priority' | 'dueDate' | 'dueTime' | 'propertyAddress' | 'contactName'> {
  const clean = command.trim()
  const lower = clean.toLowerCase()
  const propertyAddress = extractAddress(clean)
  const propertyIntent = hasPropertySchedulerSignal(lower)

  let type: SecretaryItemType = 'Reminder'

  if (lower.includes('work order') || lower.includes('repair') || lower.includes('maintenance') || lower.includes('leaking') || lower.includes('clogged') || lower.includes('broken') || lower.includes('water line')) {
    type = 'Work Order Draft'
  } else if ((lower.includes('schedule') || lower.includes('visit') || lower.includes('appointment') || lower.includes('walk through') || lower.includes('walkthrough')) && propertyIntent) {
    type = 'Scheduled Visit'
  } else if (lower.includes('call log') || lower.includes('log call') || lower.startsWith('call ') || lower.includes('called ')) {
    type = 'Call Log'
  } else if (lower.includes('owner')) {
    type = 'Owner Follow-Up'
  } else if (lower.includes('vendor') || lower.includes('contractor') || lower.includes('plumber') || lower.includes('electrician') || lower.includes('hvac')) {
    type = 'Vendor Callback'
  } else {
    type = 'Reminder'
  }

  const priority: SecretaryPriority = lower.includes('urgent') || lower.includes('emergency') || lower.includes('leak') || lower.includes('leaking') || lower.includes('no heat') || lower.includes('gas') || lower.includes('water line')
    ? 'Urgent'
    : 'Normal'

  const issue = extractIssue(clean, propertyAddress)
  let title = ''
  let details = clean

  if (type === 'Reminder') {
    title = buildReminderTitle(clean)
    const dueDate = inferDueDate(lower)
    const dueTime = extractTime(clean)
    const when = [dueDate ? `Due date: ${dueDate}` : '', dueTime ? `Time: ${dueTime}` : ''].filter(Boolean).join('\n')
    details = [when, clean].filter(Boolean).join('\n')
  } else if (type === 'Scheduled Visit') {
    title = issue || propertyAddress || 'Scheduled property visit'
    details = issue || clean
  } else if (type === 'Work Order Draft') {
    title = issue || 'Work order draft'
    details = issue || clean
  } else {
    title = issue || cleanTitle(clean) || clean
    details = clean
  }

  return {
    type,
    title: toTitleCase(title),
    details,
    priority,
    dueDate: inferDueDate(lower),
    dueTime: extractTime(clean),
    propertyAddress,
    contactName: extractContact(clean),
  }
}

function normalizeLocalItem(item: Partial<SecretaryItem>): SecretaryItem {
  const now = new Date().toISOString()

  return {
    id: item.id && item.id.length > 20 ? item.id : makeId(),
    type: item.type || 'Reminder',
    title: item.title || 'Untitled Secretary Item',
    details: item.details || '',
    status: item.status || 'Open',
    priority: item.priority || 'Normal',
    dueDate: item.dueDate || '',
    dueTime: item.dueTime || '',
    propertyAddress: item.propertyAddress || '',
    contactName: item.contactName || '',
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  }
}

function mapCloudRowToItem(row: any): SecretaryItem {
  return normalizeLocalItem({
    id: row.id,
    type: row.type,
    title: row.title,
    details: row.details || '',
    status: row.status || 'Open',
    priority: row.priority || 'Normal',
    dueDate: row.due_date || '',
    dueTime: row.due_time || '',
    propertyAddress: row.property_address || '',
    contactName: row.contact_name || '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  })
}

function mapItemToCloudRow(item: SecretaryItem) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    details: item.details,
    status: item.status,
    priority: item.priority,
    due_date: item.dueDate || null,
    due_time: item.dueTime || null,
    property_address: item.propertyAddress || null,
    contact_name: item.contactName || null,
    created_at: item.createdAt,
    updated_at: new Date().toISOString(),
  }
}

export default function FiveToolsSecretaryPage() {
  const router = useRouter()
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const [command, setCommand] = useState('')
  const [items, setItems] = useState<SecretaryItem[]>([])
  const [message, setMessage] = useState('Local task board ready.')
  const [ownerDraftOpen, setOwnerDraftOpen] = useState(false)
  const [sqlOpen, setSqlOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [selectedType, setSelectedType] = useState<'All' | SecretaryItemType>('All')
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const [ownerDraft, setOwnerDraft] = useState(
    'Hello,\n\nI wanted to provide a quick update regarding the property.\n\nAt this time, we are monitoring the item and will follow up once the next step is confirmed.\n\nThank you,\n5 Tools'
  )

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved) as Partial<SecretaryItem>[]
      if (Array.isArray(parsed)) {
        const normalized = parsed.map(normalizeLocalItem)
        setItems(normalized)
        setMessage(`Loaded ${normalized.length} saved local item${normalized.length === 1 ? '' : 's'}.`)
      }
    } catch {
      setMessage('Local saved data could not be loaded.')
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const openItems = useMemo(() => items.filter((item) => item.status === 'Open'), [items])
  const doneItems = useMemo(() => items.filter((item) => item.status === 'Done'), [items])
  const urgentItems = useMemo(() => items.filter((item) => item.priority === 'Urgent' && item.status === 'Open'), [items])
  const todayItems = useMemo(() => items.filter((item) => item.dueDate === todayIso() && item.status === 'Open'), [items])
  const overdueItems = useMemo(() => items.filter((item) => item.dueDate && item.dueDate < todayIso() && item.status === 'Open'), [items])
  const ownerFollowUps = useMemo(() => items.filter((item) => item.type === 'Owner Follow-Up' && item.status === 'Open'), [items])
  const urgentMaintenance = useMemo(() => items.filter((item) => item.type === 'Work Order Draft' && item.priority === 'Urgent' && item.status === 'Open'), [items])
  const scheduledVisits = useMemo(() => items.filter((item) => item.type === 'Scheduled Visit' && item.status === 'Open'), [items])
  const todaysCalls = useMemo(() => items.filter((item) => item.type === 'Call Log' && item.status === 'Open' && (!item.dueDate || item.dueDate === todayIso())), [items])
  const recentIntakeItems = useMemo(() => items.slice(0, 8), [items])
  const actionableItems = useMemo(() => items.filter((item) => item.type !== 'Call Log'), [items])
  const filteredItems = useMemo(() => selectedType === 'All' ? items : items.filter((item) => item.type === selectedType), [items, selectedType])

  function createItem(commandText = command) {
    const clean = commandText.trim()

    if (!clean) {
      setMessage('Type a command before running it.')
      return
    }

    const parsed = parseCommand(clean)
    const now = new Date().toISOString()
    const newItem: SecretaryItem = {
      id: makeId(),
      ...parsed,
      status: 'Open',
      createdAt: now,
      updatedAt: now,
    }

    setItems((prev) => [newItem, ...prev])
    const sentToTasks = pushSecretaryItemToTasksNotes(newItem)
    setCommand('')
    setMessage(
      sentToTasks
        ? `Created ${newItem.type}: ${newItem.title}. Sent to Tasks & Notes.`
        : `Logged ${newItem.type}: ${newItem.title}.`
    )
  }

  function updateItem(id: string, updates: Partial<SecretaryItem>) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
      )
    )
  }

  function markDone(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: item.status === 'Open' ? 'Done' : 'Open', updatedAt: new Date().toISOString() } : item
      )
    )
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
    setMessage('Secretary item deleted locally.')
  }

  function saveLocal() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    setMessage(`Saved ${items.length} item${items.length === 1 ? '' : 's'} locally.`)
  }

  function loadLocal() {
    const saved = window.localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      setMessage('No local secretary items found.')
      return
    }

    try {
      const parsed = JSON.parse(saved) as Partial<SecretaryItem>[]
      const normalized = Array.isArray(parsed) ? parsed.map(normalizeLocalItem) : []
      setItems(normalized)
      setMessage(`Loaded ${normalized.length} local item${normalized.length === 1 ? '' : 's'}.`)
    } catch {
      setMessage('Local saved data could not be loaded.')
    }
  }

  function deleteLocal() {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    setItems([])
    setMessage('Local secretary items deleted.')
  }

  function startVoiceCommand() {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setMessage('Voice command is not supported in this browser. Chrome or Edge usually works best.')
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setListening(true)
      setMessage('Listening for voice command...')
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognition.onerror = () => {
      setListening(false)
      setMessage('Voice command stopped before a command was captured.')
    }

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[0][0].transcript
      setCommand(transcript)
      createItem(transcript)
    }

    recognition.start()
  }

  function stopVoiceCommand() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  async function saveToCloud() {
    if (items.length === 0) {
      setMessage('No secretary items to save to cloud.')
      return
    }

    setCloudBusy(true)
    setMessage('Saving secretary items to cloud...')

    const { error } = await supabaseRestRequest('secretary_items?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(items.map(mapItemToCloudRow)),
    })

    setCloudBusy(false)

    if (error) {
      setMessage(`Cloud save failed: ${error.message}`)
      return
    }

    setMessage(`Saved ${items.length} secretary item${items.length === 1 ? '' : 's'} to cloud.`)
  }

  async function loadFromCloud() {
    setCloudBusy(true)
    setMessage('Loading secretary items from cloud...')

    const { data, error } = await supabaseRestRequest('secretary_items?select=*&order=updated_at.desc')

    setCloudBusy(false)

    if (error) {
      setMessage(`Cloud load failed: ${error.message}`)
      return
    }

    const loaded = (data || []).map(mapCloudRowToItem)
    setItems(loaded)
    setMessage(`Loaded ${loaded.length} secretary item${loaded.length === 1 ? '' : 's'} from cloud.`)
  }

  async function deleteFromCloud() {
    if (items.length === 0) {
      setMessage('No local items selected for cloud delete. Load cloud items first if needed.')
      return
    }

    setCloudBusy(true)
    setMessage('Deleting current secretary items from cloud...')

    const ids = items.map((item) => `"${item.id}"`).join(',')
    const { error } = await supabaseRestRequest(`secretary_items?id=in.(${ids})`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    })

    setCloudBusy(false)

    if (error) {
      setMessage(`Cloud delete failed: ${error.message}`)
      return
    }

    setMessage('Deleted current secretary items from cloud. Local copies are still shown until deleted locally.')
  }

  async function deleteSingleFromCloud(id: string) {
    setCloudBusy(true)
    const { error } = await supabaseRestRequest(`secretary_items?id=eq.${id}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    })
    setCloudBusy(false)

    if (error) {
      setMessage(`Cloud delete failed: ${error.message}`)
      return
    }

    setMessage('Secretary item deleted from cloud.')
  }

  function openOwnerDraft(item?: SecretaryItem) {
    if (item) {
      setOwnerDraft(
        `Hello,\n\nI wanted to provide a quick update regarding ${item.propertyAddress || 'the property'}.\n\n${item.details || item.title}\n\nCurrent status: ${item.status}. Priority: ${item.priority}.\n\nWe will continue monitoring this item and follow up once the next step is confirmed.\n\nThank you,\n5 Tools`
      )
    }
    setOwnerDraftOpen(true)
  }

  function appendStoredDraft(key: string, draft: Record<string, string>) {
    const existing = window.localStorage.getItem(key)

    try {
      const parsed = existing ? JSON.parse(existing) : []
      const drafts = Array.isArray(parsed) ? parsed : []
      window.localStorage.setItem(key, JSON.stringify([draft, ...drafts].slice(0, 25)))
    } catch {
      window.localStorage.setItem(key, JSON.stringify([draft]))
    }
  }

  function handoffToWorkOrder(item: SecretaryItem) {
    const now = new Date().toISOString()
    const draft = {
      source: 'secretary',
      secretaryId: item.id,
      itemType: item.type,
      title: item.title,
      jobTitle: item.title,
      description: item.details || item.title,
      details: item.details || item.title,
      priority: item.priority,
      status: 'Draft',
      propertyAddress: item.propertyAddress,
      address: item.propertyAddress,
      contactName: item.contactName,
      contact: item.contactName,
      requestedBy: item.contactName,
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      createdAt: now,
      updatedAt: now,
    }

    window.localStorage.setItem(WORK_ORDER_HANDOFF_KEY, JSON.stringify(draft))
    window.sessionStorage.setItem(WORK_ORDER_HANDOFF_KEY, JSON.stringify(draft))
    appendStoredDraft(WORK_ORDER_HANDOFF_QUEUE_KEY, draft)

    updateItem(item.id, { type: 'Work Order Draft', updatedAt: now })
    setMessage(`Work order draft handed off: ${item.title}`)

    const params = new URLSearchParams({
      source: 'secretary',
      secretaryId: item.id,
      draftKey: WORK_ORDER_HANDOFF_KEY,
      title: item.title,
      details: item.details || item.title,
      priority: item.priority,
      address: item.propertyAddress,
      contact: item.contactName,
    })

    router.push(`/work-order-engine?${params.toString()}`)
  }

  function handoffToScheduler(item: SecretaryItem) {
    const draft = {
      source: 'secretary',
      secretaryId: item.id,
      title: item.title,
      description: item.details || item.title,
      details: item.details || item.title,
      propertyAddress: item.propertyAddress,
      address: item.propertyAddress,
      contactName: item.contactName,
      contact: item.contactName,
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      priority: item.priority,
      createdAt: new Date().toISOString(),
    }

    window.localStorage.setItem(SCHEDULER_HANDOFF_KEY, JSON.stringify(draft))
    window.sessionStorage.setItem(SCHEDULER_HANDOFF_KEY, JSON.stringify(draft))
    setMessage(`Scheduled visit handed off: ${item.title}`)

    const params = new URLSearchParams({
      source: 'secretary',
      secretaryId: item.id,
      draftKey: SCHEDULER_HANDOFF_KEY,
      title: item.title,
      details: item.details || item.title,
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      address: item.propertyAddress,
      contact: item.contactName,
    })

    router.push(`/project-scheduler?${params.toString()}`)
  }

  function toggleExpanded(id: string) {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function quickCreate(type: SecretaryItemType) {
    const labelMap: Record<SecretaryItemType, string> = {
      Reminder: 'Reminder follow up needed',
      'Call Log': 'Call log new phone call',
      'Work Order Draft': 'Work order maintenance issue',
      'Owner Follow-Up': 'Owner follow-up property update',
      'Vendor Callback': 'Vendor callback pending response',
      'Scheduled Visit': 'Schedule visit property access',
    }

    const parsed = parseCommand(labelMap[type])
    const now = new Date().toISOString()
    const item: SecretaryItem = {
      id: makeId(),
      ...parsed,
      type,
      status: 'Open',
      createdAt: now,
      updatedAt: now,
    }

    setItems((prev) => [item, ...prev])
    const sentToTasks = pushSecretaryItemToTasksNotes(item)
    setMessage(
      sentToTasks
        ? `Created ${type}. Sent to Tasks & Notes. Edit the intake card details as needed.`
        : `Logged ${type}. Edit the intake card details as needed.`
    )
  }

  return (
    <main className="min-h-screen bg-[#ece3d4] text-[#2f1f14]">
      <header className="border-b border-[#8b6b47] bg-[#f7f1e7] shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-8 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-5xl font-black tracking-tight text-[#2e1f12]">Virtual Secretary</h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.35em] text-[#9c6b2f]">
              5 Tools Operations Desk
            </p>
          </div>

          <Link
            href="/"
            className="border border-[#b38b66] bg-[#fffaf3] px-5 py-3 text-center text-sm font-bold uppercase tracking-wide text-[#2f1f14] transition hover:bg-[#efe3d2]"
          >
            Back to Dashboard
          </Link>
        </div>

        <nav className="border-t border-[#8b6b47] bg-[#4d3624]">
          <div className="mx-auto flex max-w-7xl flex-wrap px-8">
            {['Command Center', 'Task Board', 'Daily Dashboard', 'Cloud', 'Messages'].map((label, index) => (
              <a
                key={label}
                href={index === 0 ? '#command-center' : index === 1 ? '#task-board' : index === 2 ? '#daily-dashboard' : index === 3 ? '#cloud-tools' : '#owner-draft'}
                className={`border-b-4 px-5 py-4 text-sm font-bold uppercase tracking-wide text-[#f5ede2] transition hover:bg-[#6b4a31] ${
                  index === 0 ? 'border-[#d4a66a]' : 'border-transparent'
                }`}
              >
                {label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden border-b border-[#b89b79]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#8b5e3c_0%,#9b6b45_8%,#7c5235_16%,#a7794f_24%,#7a5237_32%,#966845_40%,#7d5436_48%,#a1714b_56%,#815638_64%,#9c6d48_72%,#785033_80%,#a3734c_88%,#6d482d_100%)] opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_60%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-8 px-8 py-14 lg:grid-cols-[1fr_380px]">
          <div className="border border-[#d4b08a] bg-[rgba(35,20,10,0.78)] p-10 shadow-2xl backdrop-blur-sm">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#d4a66a]">Operations Center</p>
            <h2 className="mt-4 text-5xl font-black leading-tight text-[#fff8f0]">Good Evening, Eric</h2>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[#f3e8d8]">
              Command intake, call tracking, reminders, owner follow-ups, vendor callbacks, scheduled visits, and work-order drafts from one front-office desk.
            </p>
          </div>

          <aside className="border border-[#b38b66] bg-[#f8f1e7]/95 p-6 shadow-2xl backdrop-blur-sm">
            <h3 className="border-b border-[#d8c0a4] pb-3 text-2xl font-black text-[#2f1f14]">Daily Snapshot</h3>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Snapshot label="Open Items" value={openItems.length} />
              <Snapshot label="Due Today" value={todayItems.length} />
              <Snapshot label="Urgent" value={urgentItems.length} />
              <Snapshot label="Overdue" value={overdueItems.length} />
            </div>
          </aside>
        </div>
      </section>

      <section id="command-center" className="mx-auto grid max-w-7xl gap-6 px-8 py-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="border border-[#c9ab86] bg-[#fffaf3] p-6 shadow-md">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-3xl font-black text-[#2f1f14]">Secretary Command Center</h3>
                <p className="mt-2 text-sm leading-6 text-[#5f4a39]">
                  Creates real local secretary items: reminders, call logs, work-order drafts, owner follow-ups, vendor callbacks, and scheduled visits.
                </p>
              </div>

              <button
                onClick={listening ? stopVoiceCommand : startVoiceCommand}
                className={`px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition ${
                  listening ? 'bg-[#8b2f1f] hover:bg-[#6f2417]' : 'bg-[#c58a3b] hover:bg-[#ad742b]'
                }`}
              >
                {listening ? 'Stop Listening' : 'Voice Command'}
              </button>
            </div>

            <textarea
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder='Try: "add reminder call owner tomorrow" or "create work order leaking sink at 123 Main"'
              className="mt-5 min-h-32 w-full border border-[#c9ab86] bg-[#f8f1e7] p-4 text-base text-[#2f1f14] outline-none transition placeholder:text-[#8a7a68] focus:border-[#b57a32] focus:bg-white"
            />

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => createItem()}
                className="bg-[#4d3624] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#f5ede2] transition hover:bg-[#6b4a31]"
              >
                Run Command
              </button>

              <button
                onClick={() => setCommand('')}
                className="border border-[#b38b66] bg-[#f8f1e7] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#2f1f14] transition hover:bg-[#efe3d2]"
              >
                Clear
              </button>

              <button
                onClick={saveLocal}
                className="border border-[#9c6b2f] bg-[#fffaf3] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#6b4a31] transition hover:bg-[#f3e6d4]"
              >
                Save Local
              </button>

              <button
                onClick={loadLocal}
                className="border border-[#9c6b2f] bg-[#fffaf3] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#6b4a31] transition hover:bg-[#f3e6d4]"
              >
                Load Local
              </button>

              <button
                onClick={deleteLocal}
                className="border border-[#8b2f1f] bg-[#fff1ed] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#8b2f1f] transition hover:bg-[#ffe1d9]"
              >
                Delete Local
              </button>
            </div>

            <div className="mt-4 border border-[#d8c0a4] bg-[#f8f1e7] p-3 text-sm font-bold text-[#5f4a39]">
              {message}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <QuickCreateButton label="Reminder" onClick={() => quickCreate('Reminder')} />
              <QuickCreateButton label="Call Log" onClick={() => quickCreate('Call Log')} />
              <QuickCreateButton label="Work Order Draft" onClick={() => quickCreate('Work Order Draft')} />
              <QuickCreateButton label="Owner Follow-Up" onClick={() => quickCreate('Owner Follow-Up')} />
              <QuickCreateButton label="Vendor Callback" onClick={() => quickCreate('Vendor Callback')} />
              <QuickCreateButton label="Scheduled Visit" onClick={() => quickCreate('Scheduled Visit')} />
            </div>

            <div className="mt-4 border border-dashed border-[#c9ab86] bg-[#fffaf3] p-4 text-sm leading-7 text-[#5f4a39]">
              <p className="font-black text-[#2f1f14]">Voice / command examples</p>
              <p>Add reminder call owner tomorrow</p>
              <p>Create work order leaking sink at 123 Main Street urgent</p>
              <p>Schedule visit Friday at 10 AM for 14508 Union Ave</p>
              <p>Vendor callback ABC Plumbing for estimate</p>
              <p>Owner follow-up move-out update for Lakewood property</p>
            </div>
          </section>

          <section id="daily-dashboard" className="border border-[#c9ab86] bg-[#fffaf3] p-6 shadow-md">
            <h3 className="text-3xl font-black text-[#2f1f14]">Daily Dashboard View</h3>
            <p className="mt-2 text-sm leading-6 text-[#5f4a39]">
              Secretary is now intake-focused. Actionable follow-ups are sent to Tasks & Notes so reminders are not duplicated here.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <DailyPanel title="Today's Call Logs" count={todaysCalls.length} items={todaysCalls} />
              <DailyPanel title="Recent Intake" count={recentIntakeItems.length} items={recentIntakeItems} />
              <DailyPanel title="Items Sent to Tasks" count={actionableItems.length} items={actionableItems} />
              <DailyPanel title="Urgent Maintenance Intake" count={urgentMaintenance.length} items={urgentMaintenance} />
              <DailyPanel title="Scheduled Visits" count={scheduledVisits.length} items={scheduledVisits} />
              <DailyPanel title="Due Today" count={todayItems.length} items={todayItems} />
            </div>
          </section>

          <section id="task-board" className="border border-[#c9ab86] bg-[#fffaf3] p-6 shadow-md">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-3xl font-black text-[#2f1f14]">Recent Secretary Intake</h3>
                <p className="mt-2 text-sm leading-6 text-[#5f4a39]">
                  Secretary keeps the intake/history record here. Actionable reminders, owner follow-ups, vendor callbacks, scheduled visits, and work order drafts are also sent to Tasks & Notes.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
                <span className="border border-[#d8c0a4] bg-[#f8f1e7] px-3 py-2 text-[#5f4a39]">Open {openItems.length}</span>
                <span className="border border-[#d8c0a4] bg-[#f8f1e7] px-3 py-2 text-[#5f4a39]">Done {doneItems.length}</span>
                <Link href="/tasks-notes" className="border border-[#4d3624] bg-[#4d3624] px-3 py-2 text-[#f5ede2] hover:bg-[#6b4a31]">Open Tasks & Notes</Link>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(['All', 'Reminder', 'Call Log', 'Work Order Draft', 'Owner Follow-Up', 'Vendor Callback', 'Scheduled Visit'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`border px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                    selectedType === type
                      ? 'border-[#4d3624] bg-[#4d3624] text-[#f5ede2]'
                      : 'border-[#d8c0a4] bg-[#f8f1e7] text-[#5f4a39] hover:bg-[#efe3d2]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {filteredItems.length === 0 ? (
              <div className="mt-6 border border-dashed border-[#c9ab86] bg-[#f8f1e7] p-8 text-center text-sm font-bold text-[#8a7a68]">
                No secretary intake items in this view. Run a command to log one or send an action to Tasks & Notes.
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {filteredItems.map((item) => {
                  const isExpanded = expandedItems[item.id] ?? true

                  return (
                    <article key={item.id} className="w-full overflow-hidden border border-[#d8c0a4] bg-[#fffaf3] shadow-sm">
                      <div className="border-b border-[#d8c0a4] bg-[#f8f1e7] p-4">
                        <div className="grid w-full gap-4">
                          <div className="flex w-full flex-wrap items-center gap-2">
                            <span className="whitespace-nowrap bg-[#4d3624] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#f5ede2]">
                              {item.type}
                            </span>

                            <span
                              className={`whitespace-nowrap px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                                item.status === 'Open'
                                  ? 'bg-[#e8f0df] text-[#33521e]'
                                  : 'bg-[#e2d8c8] text-[#5a4633]'
                              }`}
                            >
                              {item.status}
                            </span>

                            <span
                              className={`whitespace-nowrap px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                                item.priority === 'Urgent'
                                  ? 'bg-[#fff1ed] text-[#8b2f1f]'
                                  : 'bg-[#fffaf3] text-[#6b4a31]'
                              }`}
                            >
                              {item.priority}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <input
                              value={item.title}
                              onChange={(event) => updateItem(item.id, { title: event.target.value })}
                              placeholder="Item title"
                              className="block w-full min-w-0 border border-transparent bg-transparent px-0 py-1 text-xl font-black leading-7 text-[#2f1f14] outline-none focus:border-[#c9ab86] focus:bg-[#fffaf3] focus:px-2"
                            />

                            <p className="mt-1 break-words text-xs font-bold uppercase tracking-wide text-[#9c6b2f]">
                              Created: {formatDateLabel(item.createdAt.slice(0, 10))} · Due: {formatDateLabel(item.dueDate)} {item.dueTime ? `at ${item.dueTime}` : ''}
                            </p>
                          </div>

                          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            <button
                              onClick={() => toggleExpanded(item.id)}
                              className="border border-[#b38b66] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#2f1f14] transition hover:bg-[#efe3d2]"
                            >
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </button>

                            <button
                              onClick={() => markDone(item.id)}
                              className="border border-[#b38b66] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#2f1f14] transition hover:bg-[#efe3d2]"
                            >
                              {item.status === 'Open' ? 'Mark Done' : 'Reopen'}
                            </button>

                            <button
                              onClick={() => handoffToWorkOrder(item)}
                              className="border border-[#9c6b2f] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#6b4a31] transition hover:bg-[#f3e6d4]"
                            >
                              Work Order
                            </button>

                            <button
                              onClick={() => handoffToScheduler(item)}
                              className="border border-[#9c6b2f] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#6b4a31] transition hover:bg-[#f3e6d4]"
                            >
                              Schedule
                            </button>

                            <button
                              onClick={() => openOwnerDraft(item)}
                              className="border border-[#9c6b2f] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#6b4a31] transition hover:bg-[#f3e6d4]"
                            >
                              Owner Draft
                            </button>

                            <button
                              onClick={() => deleteSingleFromCloud(item.id)}
                              disabled={cloudBusy}
                              className="border border-[#8b6b47] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#4d3624] transition hover:bg-[#efe3d2] disabled:opacity-60"
                            >
                              Delete Cloud
                            </button>

                            <button
                              onClick={() => deleteItem(item.id)}
                              className="border border-[#8b2f1f] bg-[#fff1ed] px-3 py-2 text-sm font-bold text-[#8b2f1f] transition hover:bg-[#ffe1d9]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4">
                          <textarea
                            value={item.details}
                            onChange={(event) => updateItem(item.id, { details: event.target.value })}
                            placeholder="Details"
                            className="block min-h-24 w-full resize-y border border-[#d8c0a4] bg-[#f8f1e7] p-3 text-sm leading-6 text-[#5f4a39] outline-none focus:border-[#b57a32] focus:bg-white"
                          />

                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-[#6b4a31]">
                              Due Date
                              <input
                                type="date"
                                value={item.dueDate}
                                onChange={(event) => updateItem(item.id, { dueDate: event.target.value })}
                                className="mt-1 block w-full min-w-0 border border-[#d8c0a4] bg-[#fffaf3] p-2 text-sm normal-case tracking-normal text-[#2f1f14] outline-none focus:border-[#b57a32]"
                              />
                            </label>

                            <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-[#6b4a31]">
                              Due Time
                              <input
                                value={item.dueTime}
                                onChange={(event) => updateItem(item.id, { dueTime: event.target.value })}
                                placeholder="10:00 AM"
                                className="mt-1 block w-full min-w-0 border border-[#d8c0a4] bg-[#fffaf3] p-2 text-sm normal-case tracking-normal text-[#2f1f14] outline-none focus:border-[#b57a32]"
                              />
                            </label>

                            <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-[#6b4a31]">
                              Property / Address
                              <input
                                value={item.propertyAddress}
                                onChange={(event) => updateItem(item.id, { propertyAddress: event.target.value })}
                                placeholder="Property address"
                                className="mt-1 block w-full min-w-0 border border-[#d8c0a4] bg-[#fffaf3] p-2 text-sm normal-case tracking-normal text-[#2f1f14] outline-none focus:border-[#b57a32]"
                              />
                            </label>

                            <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-[#6b4a31]">
                              Contact
                              <input
                                value={item.contactName}
                                onChange={(event) => updateItem(item.id, { contactName: event.target.value })}
                                placeholder="Owner / tenant / vendor"
                                className="mt-1 block w-full min-w-0 border border-[#d8c0a4] bg-[#fffaf3] p-2 text-sm normal-case tracking-normal text-[#2f1f14] outline-none focus:border-[#b57a32]"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="border border-[#c9ab86] bg-[#fffaf3] p-6 shadow-md">
            <h3 className="text-3xl font-black text-[#2f1f14]">Quick Actions</h3>
            <p className="mt-2 text-sm leading-6 text-[#5f4a39]">Routed actions and draft support.</p>

            <div className="mt-5 grid gap-3">
              <Link href="/work-order-engine" className="flex items-center justify-between border border-[#d8c0a4] bg-[#fffaf3] px-4 py-4 text-sm font-bold uppercase tracking-wide text-[#2f1f14] transition hover:border-[#c58a3b] hover:bg-[#f3e6d4]">
                <span>Create Work Order</span>
                <span className="text-[#9c6b2f]">→</span>
              </Link>

              <Link href="/project-scheduler" className="flex items-center justify-between border border-[#d8c0a4] bg-[#fffaf3] px-4 py-4 text-sm font-bold uppercase tracking-wide text-[#2f1f14] transition hover:border-[#c58a3b] hover:bg-[#f3e6d4]">
                <span>Schedule Visit</span>
                <span className="text-[#9c6b2f]">→</span>
              </Link>

              <button
                onClick={() => openOwnerDraft()}
                className="flex items-center justify-between border border-[#d8c0a4] bg-[#fffaf3] px-4 py-4 text-left text-sm font-bold uppercase tracking-wide text-[#2f1f14] transition hover:border-[#c58a3b] hover:bg-[#f3e6d4]"
              >
                <span>Owner Update</span>
                <span className="text-[#9c6b2f]">Draft</span>
              </button>

              <Link href="/inspections" className="flex items-center justify-between border border-[#d8c0a4] bg-[#fffaf3] px-4 py-4 text-sm font-bold uppercase tracking-wide text-[#2f1f14] transition hover:border-[#c58a3b] hover:bg-[#f3e6d4]">
                <span>Start Report</span>
                <span className="text-[#9c6b2f]">→</span>
              </Link>
            </div>
          </section>

          <section id="cloud-tools" className="border border-[#c9ab86] bg-[#fffaf3] p-6 shadow-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-3xl font-black text-[#2f1f14]">Cloud Save</h3>
                <p className="mt-2 text-sm leading-6 text-[#5f4a39]">Uses Supabase table secretary_items after SQL is installed.</p>
              </div>
              <button
                onClick={() => setSqlOpen((prev) => !prev)}
                className="border border-[#b38b66] bg-[#f8f1e7] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#2f1f14] transition hover:bg-[#efe3d2]"
              >
                SQL
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                onClick={saveToCloud}
                disabled={cloudBusy}
                className="bg-[#4d3624] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#f5ede2] transition hover:bg-[#6b4a31] disabled:opacity-60"
              >
                Save to Cloud
              </button>

              <button
                onClick={loadFromCloud}
                disabled={cloudBusy}
                className="border border-[#9c6b2f] bg-[#fffaf3] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#6b4a31] transition hover:bg-[#f3e6d4] disabled:opacity-60"
              >
                Load from Cloud
              </button>

              <button
                onClick={deleteFromCloud}
                disabled={cloudBusy}
                className="border border-[#8b2f1f] bg-[#fff1ed] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#8b2f1f] transition hover:bg-[#ffe1d9] disabled:opacity-60"
              >
                Delete from Cloud
              </button>
            </div>

            {sqlOpen && (
              <pre className="mt-5 overflow-auto border border-[#d8c0a4] bg-[#2f1f14] p-4 text-xs leading-5 text-[#f5ede2]">
                {SUPABASE_SQL}
              </pre>
            )}
          </section>

          {ownerDraftOpen && (
            <section id="owner-draft" className="border border-[#c9ab86] bg-[#fffaf3] p-6 shadow-md">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-2xl font-black text-[#2f1f14]">Owner Update Draft</h3>
                <button
                  onClick={() => setOwnerDraftOpen(false)}
                  className="border border-[#b38b66] bg-[#f8f1e7] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#2f1f14] transition hover:bg-[#efe3d2]"
                >
                  Close
                </button>
              </div>
              <textarea
                value={ownerDraft}
                onChange={(event) => setOwnerDraft(event.target.value)}
                className="mt-4 min-h-64 w-full border border-[#c9ab86] bg-[#f8f1e7] p-4 text-sm leading-6 text-[#2f1f14] outline-none focus:border-[#b57a32] focus:bg-white"
              />
            </section>
          )}
        </aside>
      </section>

      <footer className="border-t border-[#8b6b47] bg-[#3f2a1b] px-8 py-6 text-center text-xs leading-6 text-[#f1e6d8]">
        5 Tools Virtual Secretary supports maintenance intake, scheduling, reminders, local task tracking, cloud save, work-order handoff, and office workflow management.
      </footer>
    </main>
  )
}

function Snapshot({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[#d8c0a4] bg-[#fffaf3] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#9c6b2f]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#2f1f14]">{value}</p>
    </div>
  )
}

function QuickCreateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="border border-[#d8c0a4] bg-[#f8f1e7] px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#5f4a39] transition hover:border-[#c58a3b] hover:bg-[#f3e6d4]"
    >
      + {label}
    </button>
  )
}

function DailyPanel({ title, count, items }: { title: string; count: number; items: SecretaryItem[] }) {
  return (
    <div className="border border-[#d8c0a4] bg-[#f8f1e7] p-4">
      <div className="flex items-center justify-between gap-3 border-b border-[#d8c0a4] pb-3">
        <h4 className="text-lg font-black text-[#2f1f14]">{title}</h4>
        <span className="bg-[#4d3624] px-3 py-1 text-xs font-bold text-[#f5ede2]">{count}</span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm font-bold text-[#8a7a68]">Nothing showing.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.slice(0, 4).map((item) => (
            <div key={item.id} className="border border-[#d8c0a4] bg-[#fffaf3] p-3">
              <p className="font-bold text-[#2f1f14]">{item.title}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#9c6b2f]">
                {item.type} {item.dueDate ? `· ${formatDateLabel(item.dueDate)}` : ''} {item.dueTime ? `· ${item.dueTime}` : ''}
              </p>
              {item.propertyAddress && <p className="mt-1 text-sm text-[#5f4a39]">{item.propertyAddress}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
