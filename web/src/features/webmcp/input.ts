/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
export type ToolError = { error: string }

export function isToolError(value: unknown): value is ToolError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  )
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim()
    if (message) return message
  }
  return 'Request failed'
}

export async function callApi<T>(
  signal: AbortSignal,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T | ToolError> {
  try {
    signal.throwIfAborted()
    return await run(signal)
  } catch (error) {
    if (signal.aborted) throw error
    return { error: messageOf(error) }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readRecord(
  input: unknown
): Record<string, unknown> | ToolError {
  if (input == null) return {}
  if (!isRecord(input)) return { error: 'Tool input must be an object.' }
  return input
}

export function readInteger(
  value: unknown,
  name: string,
  bounds: { min: number; max: number; fallback?: number }
): number | ToolError {
  if (value == null) {
    if (bounds.fallback != null) return bounds.fallback
    return { error: `${name} is required.` }
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { error: `${name} must be an integer.` }
  }
  if (value < bounds.min || value > bounds.max) {
    return {
      error: `${name} must be between ${bounds.min} and ${bounds.max}.`,
    }
  }
  return value
}

export function readOptionalInteger(
  value: unknown,
  name: string,
  bounds: { min: number; max: number }
): number | undefined | ToolError {
  if (value == null) return undefined
  return readInteger(value, name, bounds)
}

export function readUnixSeconds(
  value: unknown,
  name: string
): number | undefined | ToolError {
  if (value == null) return undefined
  if (typeof value === 'number' && value > 10_000_000_000) {
    return { error: `${name} must be unix seconds.` }
  }
  return readInteger(value, name, { min: 0, max: 10_000_000_000 })
}

export function readBoolean(
  value: unknown,
  name: string,
  fallback?: boolean
): boolean | ToolError {
  if (value == null) {
    if (fallback != null) return fallback
    return { error: `${name} is required.` }
  }
  if (typeof value !== 'boolean') return { error: `${name} must be a boolean.` }
  return value
}

export function readString(
  value: unknown,
  name: string,
  options: { required: boolean; max: number }
): string | ToolError {
  if (value == null || value === '') {
    if (!options.required) return ''
    return { error: `${name} is required.` }
  }
  if (typeof value !== 'string') return { error: `${name} must be a string.` }
  const trimmed = value.trim()
  if (!trimmed) return { error: `${name} is required.` }
  if (trimmed.length > options.max) {
    return { error: `${name} must be at most ${options.max} characters.` }
  }
  if (hasDisallowedControl(trimmed, false)) {
    return { error: `${name} contains unsupported characters.` }
  }
  return trimmed
}

export function readOptionalString(
  value: unknown,
  name: string,
  max: number
): string | undefined | ToolError {
  if (value == null || value === '') return undefined
  const text = readString(value, name, { required: true, max })
  if (isToolError(text)) return text
  return text
}

export function readStringList(
  value: unknown,
  name: string,
  limits: { maxItems: number; maxLength: number }
): string[] | ToolError {
  if (value == null) return []
  if (!Array.isArray(value)) {
    return { error: `${name} must be a list of strings.` }
  }
  if (value.length > limits.maxItems) {
    return { error: `${name} must contain at most ${limits.maxItems} items.` }
  }
  const items: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') {
      return { error: `${name} must be a list of strings.` }
    }
    const trimmed = item.trim()
    if (!trimmed) return { error: `${name} cannot contain a blank item.` }
    if (trimmed.length > limits.maxLength) {
      return {
        error: `${name} items must be at most ${limits.maxLength} characters.`,
      }
    }
    items.push(trimmed)
  }
  return items
}

export function hasDisallowedControl(
  value: string,
  allowLineBreaks: boolean
): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code === 0x7f) return true
    if (code >= 0x20) continue
    if (allowLineBreaks && (code === 0x09 || code === 0x0a || code === 0x0d)) {
      continue
    }
    return true
  }
  return false
}

export function readPage(
  record: Record<string, unknown>
): { page: number; pageSize: number } | ToolError {
  const page = readInteger(record.page, 'page', {
    min: 1,
    max: 1000,
    fallback: 1,
  })
  if (isToolError(page)) return page
  const pageSize = readInteger(record.page_size, 'page_size', {
    min: 1,
    max: 50,
    fallback: 20,
  })
  if (isToolError(pageSize)) return pageSize
  return { page, pageSize }
}
