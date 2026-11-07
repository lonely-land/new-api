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
import type { ApiKey, ApiKeyFormData } from '@/features/keys/types'
import type { Model } from '@/features/models/types'
import type {
  GetLogsParams,
  GetLogsResponse,
} from '@/features/usage-logs/types'
import type { User } from '@/features/users/types'
import { parseQuotaFromDollars } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import type { AuthUser } from '@/stores/auth-store'

import {
  callApi,
  hasDisallowedControl,
  isToolError,
  messageOf,
  readBoolean,
  readInteger,
  readOptionalInteger,
  readOptionalString,
  readPage,
  readRecord,
  readString,
  readStringList,
  readUnixSeconds,
  type ToolError,
} from './input'
import {
  canOpenConsolePage,
  findConsolePage,
  pagesForRole,
  type ConsolePageId,
} from './pages'
import {
  mapList,
  summarizeApiKey,
  summarizeChannel,
  summarizeModel,
  summarizeUsageLog,
  summarizeUser,
  type ChannelListItem,
} from './summaries'

export type ConsoleActor = {
  id: number
  username: string
  displayName: string
  role: number
  group: string
  quota: number
  usedQuota: number
  requestCount: number
}

type ListResponse<T> = {
  success: boolean
  message?: string
  data?: {
    items?: T[]
    total?: number
    page?: number
    page_size?: number
  }
}

type MutationResponse = {
  success: boolean
  message?: string
}

const MAX_KEY_LIFETIME_SECONDS = 20 * 366 * 24 * 60 * 60

export function toConsoleActor(user: AuthUser): ConsoleActor {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name ?? '',
    role: user.role,
    group: user.group ?? '',
    quota: user.quota ?? 0,
    usedQuota: user.used_quota ?? 0,
    requestCount: user.request_count ?? 0,
  }
}

function roleName(role: number): 'root' | 'admin' | 'user' | 'guest' {
  if (role === ROLE.SUPER_ADMIN) return 'root'
  if (role >= ROLE.ADMIN) return 'admin'
  if (role >= ROLE.USER) return 'user'
  return 'guest'
}

function requireAdmin(actor: ConsoleActor): ToolError | null {
  if (actor.role >= ROLE.ADMIN) return null
  return { error: 'This action requires an administrator.' }
}

export function readConsoleContext(actor: ConsoleActor, pathname: string) {
  return {
    user: {
      id: actor.id,
      username: actor.username,
      display_name: actor.displayName,
      role: actor.role,
      role_name: roleName(actor.role),
      group: actor.group,
      quota: actor.quota,
      used_quota: actor.usedQuota,
      request_count: actor.requestCount,
    },
    path: pathname,
    pages: pagesForRole(actor.role),
  }
}

export async function navigateConsole(
  input: unknown,
  ctx: {
    actor: ConsoleActor
    signal: AbortSignal
    open: (pageId: ConsolePageId) => Promise<void>
  }
) {
  ctx.signal.throwIfAborted()
  const record = readRecord(input)
  if (isToolError(record)) return record
  const pageId = readString(record.page, 'page', { required: true, max: 64 })
  if (isToolError(pageId)) return pageId
  const page = findConsolePage(pageId)
  const allowed = pagesForRole(ctx.actor.role).map((item) => item.id)
  if (!page) return { error: 'Unknown console page.', pages: allowed }
  if (!canOpenConsolePage(ctx.actor.role, page)) {
    return {
      error:
        page.access === 'root'
          ? 'This page requires a root administrator.'
          : 'This action requires an administrator.',
      pages: allowed,
    }
  }
  try {
    ctx.signal.throwIfAborted()
    await ctx.open(page.id)
    ctx.signal.throwIfAborted()
  } catch (error) {
    if (ctx.signal.aborted) throw error
    return { error: messageOf(error) }
  }
  return { page: page.id, path: page.href }
}

export async function listConsoleApiKeys(
  input: unknown,
  ctx: {
    signal: AbortSignal
    list: (
      params: { p: number; size: number },
      signal: AbortSignal
    ) => Promise<ListResponse<ApiKey>>
    search: (
      params: { keyword: string; p: number; size: number },
      signal: AbortSignal
    ) => Promise<ListResponse<ApiKey>>
  }
) {
  const record = readRecord(input)
  if (isToolError(record)) return record
  const paging = readPage(record)
  if (isToolError(paging)) return paging
  const keyword = readOptionalString(record.keyword, 'keyword', 64)
  if (isToolError(keyword)) return keyword
  const response = await callApi(ctx.signal, (signal) =>
    keyword
      ? ctx.search({ keyword, p: paging.page, size: paging.pageSize }, signal)
      : ctx.list({ p: paging.page, size: paging.pageSize }, signal)
  )
  if (isToolError(response)) return response
  return mapList(response, summarizeApiKey)
}

export async function createConsoleApiKey(
  input: unknown,
  ctx: {
    signal: AbortSignal
    nowSeconds: number
    create: (
      data: ApiKeyFormData,
      signal: AbortSignal
    ) => Promise<{ success: boolean; message?: string; data?: ApiKey }>
    invalidate: () => Promise<void>
  }
) {
  const record = readRecord(input)
  if (isToolError(record)) return record
  const name = readString(record.name, 'name', { required: true, max: 64 })
  if (isToolError(name)) return name
  const unlimited = readBoolean(record.unlimited_quota, 'unlimited_quota', true)
  if (isToolError(unlimited)) return unlimited
  const group = readOptionalString(record.group, 'group', 64)
  if (isToolError(group)) return group
  const modelLimits = readStringList(record.model_limits, 'model_limits', {
    maxItems: 64,
    maxLength: 128,
  })
  if (isToolError(modelLimits)) return modelLimits
  const allowIps = readAllowIps(record.allow_ips)
  if (isToolError(allowIps)) return allowIps
  const expiresAt = readOptionalInteger(record.expires_at, 'expires_at', {
    min: ctx.nowSeconds + 1,
    max: ctx.nowSeconds + MAX_KEY_LIFETIME_SECONDS,
  })
  if (isToolError(expiresAt)) return expiresAt

  let remainQuota = 0
  if (!unlimited) {
    const dollars = record.quota_dollars
    if (
      typeof dollars !== 'number' ||
      !Number.isFinite(dollars) ||
      dollars < 0 ||
      dollars > 1_000_000
    ) {
      return { error: 'quota_dollars must be a number from 0 to 1000000.' }
    }
    remainQuota = parseQuotaFromDollars(dollars)
  }

  const response = await callApi(ctx.signal, (signal) =>
    ctx.create(
      {
        name,
        remain_quota: remainQuota,
        expired_time: expiresAt ?? -1,
        unlimited_quota: unlimited,
        model_limits_enabled: modelLimits.length > 0,
        model_limits: modelLimits.join(','),
        allow_ips: allowIps,
        group: group ?? '',
        auto_groups: [],
        cross_group_retry: group === 'auto',
      },
      signal
    )
  )
  if (isToolError(response)) return response
  if (response.success !== true || !response.data) {
    return { error: response.message?.trim() || 'Request failed' }
  }
  await ctx.invalidate()
  return { ...summarizeApiKey(response.data), key: response.data.key }
}

function readAllowIps(value: unknown): string | ToolError {
  if (value == null || value === '') return ''
  if (typeof value !== 'string') return { error: 'allow_ips must be a string.' }
  if (value.length > 1024) {
    return { error: 'allow_ips must be at most 1024 characters.' }
  }
  if (hasDisallowedControl(value, true)) {
    return { error: 'allow_ips contains unsupported characters.' }
  }
  return value.trim()
}

export async function setConsoleApiKeyStatus(
  input: unknown,
  ctx: {
    signal: AbortSignal
    update: (
      id: number,
      status: number,
      signal: AbortSignal
    ) => Promise<MutationResponse>
    invalidate: () => Promise<void>
  }
) {
  const parsed = readIdAndEnabled(input)
  if (isToolError(parsed)) return parsed
  const status = parsed.enabled
    ? API_KEY_STATUS.ENABLED
    : API_KEY_STATUS.DISABLED
  const response = await callApi(ctx.signal, (signal) =>
    ctx.update(parsed.id, status, signal)
  )
  if (isToolError(response)) return response
  if (response.success !== true) {
    return { error: response.message?.trim() || 'Request failed' }
  }
  await ctx.invalidate()
  return {
    id: parsed.id,
    status: parsed.enabled ? 'enabled' : 'disabled',
  }
}

export async function deleteConsoleApiKey(
  input: unknown,
  ctx: {
    signal: AbortSignal
    remove: (id: number, signal: AbortSignal) => Promise<MutationResponse>
    invalidate: () => Promise<void>
  }
) {
  const record = readRecord(input)
  if (isToolError(record)) return record
  const id = readInteger(record.id, 'id', { min: 1, max: 1_000_000_000 })
  if (isToolError(id)) return id
  const response = await callApi(ctx.signal, (signal) => ctx.remove(id, signal))
  if (isToolError(response)) return response
  if (response.success !== true) {
    return { error: response.message?.trim() || 'Request failed' }
  }
  await ctx.invalidate()
  return { id, deleted: true }
}

export async function searchConsoleUsageLogs(
  input: unknown,
  ctx: {
    actor: ConsoleActor
    signal: AbortSignal
    getUserLogs: (
      params: Omit<GetLogsParams, 'username' | 'channel'>,
      signal: AbortSignal
    ) => Promise<GetLogsResponse>
    getAllLogs: (
      params: GetLogsParams,
      signal: AbortSignal
    ) => Promise<GetLogsResponse>
  }
) {
  const record = readRecord(input)
  if (isToolError(record)) return record
  const paging = readPage(record)
  if (isToolError(paging)) return paging
  const modelName = readOptionalString(record.model_name, 'model_name', 128)
  if (isToolError(modelName)) return modelName
  const tokenName = readOptionalString(record.token_name, 'token_name', 128)
  if (isToolError(tokenName)) return tokenName
  const username = readOptionalString(record.username, 'username', 64)
  if (isToolError(username)) return username
  const channel = readOptionalInteger(record.channel, 'channel', {
    min: 1,
    max: 1_000_000_000,
  })
  if (isToolError(channel)) return channel
  const start = readUnixSeconds(record.start_timestamp, 'start_timestamp')
  if (isToolError(start)) return start
  const end = readUnixSeconds(record.end_timestamp, 'end_timestamp')
  if (isToolError(end)) return end
  if (start != null && end != null && start > end) {
    return { error: 'start_timestamp must be before end_timestamp.' }
  }
  if ((username || channel != null) && ctx.actor.role < ROLE.ADMIN) {
    return {
      error: 'Filtering by username or channel requires an administrator.',
    }
  }

  const shared = {
    p: paging.page,
    page_size: paging.pageSize,
    model_name: modelName,
    token_name: tokenName,
    start_timestamp: start,
    end_timestamp: end,
  }
  const response = await callApi(ctx.signal, (signal) =>
    ctx.actor.role >= ROLE.ADMIN
      ? ctx.getAllLogs({ ...shared, username, channel }, signal)
      : ctx.getUserLogs(shared, signal)
  )
  if (isToolError(response)) return response
  return mapList(response, summarizeUsageLog)
}

export async function listConsoleChannels(
  input: unknown,
  ctx: {
    actor: ConsoleActor
    signal: AbortSignal
    list: (
      params: { p: number; page_size: number; status?: string },
      signal: AbortSignal
    ) => Promise<ListResponse<ChannelListItem>>
  }
) {
  const denied = requireAdmin(ctx.actor)
  if (denied) return denied
  const record = readRecord(input)
  if (isToolError(record)) return record
  const paging = readPage(record)
  if (isToolError(paging)) return paging
  const status = readChannelStatus(record.status)
  if (isToolError(status)) return status
  const response = await callApi(ctx.signal, (signal) =>
    ctx.list(
      {
        p: paging.page,
        page_size: paging.pageSize,
        status: status ?? undefined,
      },
      signal
    )
  )
  if (isToolError(response)) return response
  return mapList(response, summarizeChannel)
}

function readChannelStatus(value: unknown): string | undefined | ToolError {
  if (value == null || value === '' || value === 'all') return undefined
  if (value === 'enabled' || value === 'disabled') return value
  return { error: 'status must be enabled, disabled, or all.' }
}

export async function setConsoleChannelStatus(
  input: unknown,
  ctx: {
    actor: ConsoleActor
    signal: AbortSignal
    update: (
      id: number,
      status: number,
      signal: AbortSignal
    ) => Promise<MutationResponse>
    invalidate: () => Promise<void>
  }
) {
  const denied = requireAdmin(ctx.actor)
  if (denied) return denied
  const parsed = readIdAndEnabled(input)
  if (isToolError(parsed)) return parsed
  const status = parsed.enabled
    ? CHANNEL_STATUS.ENABLED
    : CHANNEL_STATUS.MANUAL_DISABLED
  const response = await callApi(ctx.signal, (signal) =>
    ctx.update(parsed.id, status, signal)
  )
  if (isToolError(response)) return response
  if (response.success !== true) {
    return { error: response.message?.trim() || 'Request failed' }
  }
  await ctx.invalidate()
  return {
    id: parsed.id,
    status: parsed.enabled ? 'enabled' : 'disabled',
  }
}

export async function listConsoleUsers(
  input: unknown,
  ctx: {
    actor: ConsoleActor
    signal: AbortSignal
    list: (
      params: { p: number; page_size: number },
      signal: AbortSignal
    ) => Promise<ListResponse<User>>
  }
) {
  const denied = requireAdmin(ctx.actor)
  if (denied) return denied
  const record = readRecord(input)
  if (isToolError(record)) return record
  const paging = readPage(record)
  if (isToolError(paging)) return paging
  const response = await callApi(ctx.signal, (signal) =>
    ctx.list({ p: paging.page, page_size: paging.pageSize }, signal)
  )
  if (isToolError(response)) return response
  return mapList(response, summarizeUser)
}

export async function searchConsoleModels(
  input: unknown,
  ctx: {
    actor: ConsoleActor
    signal: AbortSignal
    list: (
      params: { p: number; page_size: number },
      signal: AbortSignal
    ) => Promise<ListResponse<Model>>
    search: (
      params: { keyword: string; p: number; page_size: number },
      signal: AbortSignal
    ) => Promise<ListResponse<Model>>
  }
) {
  const denied = requireAdmin(ctx.actor)
  if (denied) return denied
  const record = readRecord(input)
  if (isToolError(record)) return record
  const paging = readPage(record)
  if (isToolError(paging)) return paging
  const keyword = readOptionalString(record.keyword, 'keyword', 100)
  if (isToolError(keyword)) return keyword
  const response = await callApi(ctx.signal, (signal) =>
    keyword
      ? ctx.search(
          { keyword, p: paging.page, page_size: paging.pageSize },
          signal
        )
      : ctx.list({ p: paging.page, page_size: paging.pageSize }, signal)
  )
  if (isToolError(response)) return response
  return mapList(response, summarizeModel)
}

function readIdAndEnabled(
  input: unknown
): { id: number; enabled: boolean } | ToolError {
  const record = readRecord(input)
  if (isToolError(record)) return record
  const id = readInteger(record.id, 'id', { min: 1, max: 1_000_000_000 })
  if (isToolError(id)) return id
  const enabled = readBoolean(record.enabled, 'enabled')
  if (isToolError(enabled)) return enabled
  return { id, enabled }
}
