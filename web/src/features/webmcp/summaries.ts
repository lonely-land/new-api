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
import { CHANNEL_STATUS } from '@/features/channels/constants'
import { API_KEY_STATUS } from '@/features/keys/constants'

import type { ToolError } from './input'

export type LooseListResponse = {
  success: boolean
  message?: string
  data?: {
    items?: unknown[]
    total?: number
    page?: number
    page_size?: number
  }
}

export function mapList<R>(
  response: LooseListResponse,
  mapItem: (item: unknown) => R
): { items: R[]; total: number; page: number; page_size: number } | ToolError {
  if (
    response.success !== true ||
    !response.data ||
    !Array.isArray(response.data.items)
  ) {
    return { error: response.message?.trim() || 'Request failed' }
  }
  const items = response.data.items
  return {
    items: items.map(mapItem),
    total: response.data.total ?? items.length,
    page: response.data.page ?? 1,
    page_size: response.data.page_size ?? items.length,
  }
}

function apiKeyStatusLabel(status: number): string {
  switch (status) {
    case API_KEY_STATUS.ENABLED:
      return 'enabled'
    case API_KEY_STATUS.DISABLED:
      return 'disabled'
    case API_KEY_STATUS.EXPIRED:
      return 'expired'
    case API_KEY_STATUS.EXHAUSTED:
      return 'exhausted'
    default:
      return 'unknown'
  }
}

function recordField(item: unknown): Record<string, unknown> | null {
  if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
    return item as Record<string, unknown>
  }
  return null
}

function textField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  return typeof value === 'number' ? value : 0
}

function nullableNumber(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'number' ? value : null
}

export function summarizeApiKey(item: unknown) {
  const record = recordField(item)
  const status = record ? numberField(record, 'status') : 0
  return {
    id: record ? numberField(record, 'id') : 0,
    name: record ? textField(record, 'name') : '',
    status,
    status_label: apiKeyStatusLabel(status),
    remain_quota: record ? numberField(record, 'remain_quota') : 0,
    used_quota: record ? numberField(record, 'used_quota') : 0,
    unlimited_quota: record?.unlimited_quota === true,
    expired_time: record ? numberField(record, 'expired_time') : 0,
    created_time: record ? numberField(record, 'created_time') : 0,
    accessed_time: record ? numberField(record, 'accessed_time') : 0,
    group: record ? textField(record, 'group') : '',
    model_limits_enabled: record?.model_limits_enabled === true,
    model_limits: record ? textField(record, 'model_limits') : '',
    allow_ips: record ? textField(record, 'allow_ips') : '',
  }
}

function channelStatusLabel(status: number): string {
  switch (status) {
    case CHANNEL_STATUS.ENABLED:
      return 'enabled'
    case CHANNEL_STATUS.MANUAL_DISABLED:
      return 'disabled'
    case CHANNEL_STATUS.AUTO_DISABLED:
      return 'auto_disabled'
    default:
      return 'unknown'
  }
}

export type ChannelListItem = {
  id: number
  name: string
  type: number
  status: number
  models: string
  group: string
  priority?: number | null
  weight?: number | null
  balance: number
  tag?: string | null
  base_url?: string | null
  key?: string
  openai_organization?: string | null
  other?: string
  setting?: string | null
}

export function summarizeChannel(item: unknown) {
  const record = recordField(item)
  const status = record ? numberField(record, 'status') : 0
  return {
    id: record ? numberField(record, 'id') : 0,
    name: record ? textField(record, 'name') : '',
    type: record ? numberField(record, 'type') : 0,
    status,
    status_label: channelStatusLabel(status),
    models: record ? textField(record, 'models') : '',
    group: record ? textField(record, 'group') : '',
    priority: record ? nullableNumber(record, 'priority') : null,
    weight: record ? nullableNumber(record, 'weight') : null,
    balance: record ? numberField(record, 'balance') : 0,
    tag: record ? textField(record, 'tag') : '',
    base_url: record ? textField(record, 'base_url') : '',
  }
}

export function summarizeUser(item: unknown) {
  const record = recordField(item)
  return {
    id: record ? numberField(record, 'id') : 0,
    username: record ? textField(record, 'username') : '',
    display_name: record ? textField(record, 'display_name') : '',
    role: record ? numberField(record, 'role') : 0,
    status: record ? numberField(record, 'status') : 0,
    group: record ? textField(record, 'group') : '',
    quota: record ? numberField(record, 'quota') : 0,
    used_quota: record ? numberField(record, 'used_quota') : 0,
    request_count: record ? numberField(record, 'request_count') : 0,
  }
}

export function summarizeModel(item: unknown) {
  const record = recordField(item)
  const groups = record?.enable_groups
  const squareState = record?.square_state
  return {
    id: record ? numberField(record, 'id') : 0,
    model_name: record ? textField(record, 'model_name') : '',
    status: record ? numberField(record, 'status') : 0,
    vendor_id: record ? nullableNumber(record, 'vendor_id') : null,
    square_state: typeof squareState === 'string' ? squareState : null,
    enable_groups: Array.isArray(groups)
      ? groups.filter((group) => typeof group === 'string')
      : [],
  }
}

export function summarizeUsageLog(item: unknown) {
  const record = recordField(item)
  if (!record) {
    return {
      id: 0,
      created_at: 0,
      type: 0,
      model_name: '',
      token_name: '',
      username: '',
      quota: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      use_time: 0,
      is_stream: false,
      channel: 0,
      channel_name: '',
      group: '',
      request_id: '',
    }
  }
  return {
    id: numberField(record, 'id'),
    created_at: numberField(record, 'created_at'),
    type: numberField(record, 'type'),
    model_name: textField(record, 'model_name'),
    token_name: textField(record, 'token_name'),
    username: textField(record, 'username'),
    quota: numberField(record, 'quota'),
    prompt_tokens: numberField(record, 'prompt_tokens'),
    completion_tokens: numberField(record, 'completion_tokens'),
    use_time: numberField(record, 'use_time'),
    is_stream: record.is_stream === true,
    channel: numberField(record, 'channel'),
    channel_name: textField(record, 'channel_name'),
    group: textField(record, 'group'),
    request_id: textField(record, 'request_id'),
  }
}
