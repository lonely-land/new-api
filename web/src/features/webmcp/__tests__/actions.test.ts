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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { CHANNEL_STATUS } from '@/features/channels/constants'
import { API_KEY_STATUS } from '@/features/keys/constants'
import type { ApiKey } from '@/features/keys/types'
import type { Model } from '@/features/models/types'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import type { User } from '@/features/users/types'
import { ROLE } from '@/lib/roles'
import type { AuthUser } from '@/stores/auth-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import {
  createConsoleApiKey,
  deleteConsoleApiKey,
  listConsoleApiKeys,
  listConsoleChannels,
  listConsoleUsers,
  navigateConsole,
  readConsoleContext,
  searchConsoleModels,
  searchConsoleUsageLogs,
  setConsoleApiKeyStatus,
  setConsoleChannelStatus,
  toConsoleActor,
  type ConsoleActor,
} from '../actions'

const nowSeconds = 1_800_000_000

function actor(role: number): ConsoleActor {
  return {
    id: 3,
    username: 'rain',
    displayName: 'Rain',
    role,
    group: 'default',
    quota: 9,
    usedQuota: 2,
    requestCount: 6,
  }
}

function apiKey(key = 'sk-secret'): ApiKey {
  return {
    id: 7,
    name: 'production',
    key,
    status: API_KEY_STATUS.ENABLED,
    remain_quota: 10,
    used_quota: 2,
    unlimited_quota: true,
    expired_time: -1,
    created_time: 1,
    accessed_time: 2,
    group: 'default',
    auto_groups: [],
    cross_group_retry: false,
    model_limits_enabled: false,
    model_limits: '',
    allow_ips: '',
  }
}

function usageLog(): UsageLog {
  return {
    id: 9,
    user_id: 3,
    created_at: 100,
    type: 2,
    content: 'prompt secret',
    username: 'ada',
    token_name: 'prod',
    model_name: 'gpt',
    quota: 5,
    prompt_tokens: 1,
    completion_tokens: 2,
    use_time: 3,
    is_stream: false,
    channel: 4,
    channel_name: 'openai',
    token_id: 8,
    group: 'default',
    ip: '10.1.1.1',
    other: '{"secret":true}',
    request_id: 'req_1',
    upstream_request_id: 'up_1',
  }
}

function account(): User {
  return {
    id: 4,
    username: 'ada',
    display_name: 'Ada',
    password: 'hash',
    email: 'ada@example.com',
    quota: 1,
    used_quota: 2,
    request_count: 3,
    group: 'default',
    status: 1,
    role: ROLE.USER,
  }
}

function model(): Model {
  return {
    id: 5,
    model_name: 'gpt',
    status: 1,
    sync_official: 0,
    created_time: 1,
    updated_time: 1,
    name_rule: 0,
  }
}

function signal() {
  return new AbortController().signal
}

beforeEach(() => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})

afterEach(() => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})

test('signed-in context keeps the account summary and drops the email address', () => {
  const user: AuthUser = {
    id: 3,
    username: 'rain',
    display_name: 'Rain',
    email: 'rain@example.com',
    role: ROLE.USER,
    group: 'default',
    quota: 9,
    used_quota: 2,
    request_count: 6,
  }

  const summary = toConsoleActor(user)
  const context = readConsoleContext(summary, '/keys')

  expect(summary).toEqual(actor(ROLE.USER))
  expect(JSON.stringify(context)).not.toContain('rain@example.com')
  expect(context.user.role_name).toBe('user')
  expect(context.path).toBe('/keys')
  expect(context.pages.map((page) => page.id)).toContain('keys')
  expect(context.pages.map((page) => page.id)).not.toContain('channels')
  expect(context.pages.map((page) => page.id)).not.toContain('settings-billing')
})

test('administrator context includes channels and omits root settings', () => {
  const pages = readConsoleContext(actor(ROLE.ADMIN), '/channels').pages.map(
    (page) => page.id
  )

  expect(pages).toContain('channels')
  expect(pages).not.toContain('settings-billing')
})

test('root context includes billing settings', () => {
  const pages = readConsoleContext(actor(ROLE.SUPER_ADMIN), '/').pages.map(
    (page) => page.id
  )

  expect(pages).toContain('settings-billing')
})

test('navigating to an unknown page returns the allowed pages and does not open one', async () => {
  const open = vi.fn()

  const result = await navigateConsole(
    { page: 'https://evil.example' },
    { actor: actor(ROLE.USER), signal: signal(), open }
  )

  expect(result).toMatchObject({ error: 'Unknown console page.' })
  expect(open).not.toHaveBeenCalled()
})

test('a user navigating to channels is refused before the page opens', async () => {
  const open = vi.fn()

  const result = await navigateConsole(
    { page: 'channels' },
    { actor: actor(ROLE.USER), signal: signal(), open }
  )

  expect(result).toMatchObject({
    error: 'This action requires an administrator.',
  })
  expect(open).not.toHaveBeenCalled()
})

test('a user navigating to keys opens that page', async () => {
  const open = vi.fn()

  const result = await navigateConsole(
    { page: 'keys' },
    { actor: actor(ROLE.USER), signal: signal(), open }
  )

  expect(open).toHaveBeenCalledWith('keys')
  expect(result).toEqual({ page: 'keys', path: '/keys' })
})

test('an administrator cannot open root settings', async () => {
  const open = vi.fn()

  const result = await navigateConsole(
    { page: 'settings-billing' },
    { actor: actor(ROLE.ADMIN), signal: signal(), open }
  )

  expect(result).toMatchObject({
    error: 'This page requires a root administrator.',
  })
  expect(open).not.toHaveBeenCalled()
})

test('listing API keys omits the key secret', async () => {
  const list = vi.fn().mockResolvedValue({
    success: true,
    data: { items: [apiKey()], total: 1, page: 1, page_size: 20 },
  })
  const search = vi.fn()

  const result = await listConsoleApiKeys(
    {},
    { signal: signal(), list, search }
  )

  expect(search).not.toHaveBeenCalled()
  expect(JSON.stringify(result)).not.toContain('sk-secret')
  expect(result).toMatchObject({ items: [{ id: 7, name: 'production' }] })
})

test('a key name search does not send a raw token', async () => {
  const list = vi.fn()
  const search = vi.fn().mockResolvedValue({
    success: true,
    data: { items: [], total: 0, page: 1, page_size: 20 },
  })
  const current = signal()

  await listConsoleApiKeys(
    { keyword: 'prod' },
    { signal: current, list, search }
  )

  expect(list).not.toHaveBeenCalled()
  expect(search).toHaveBeenCalledWith(
    { keyword: 'prod', p: 1, size: 20 },
    current
  )
})

test('an out-of-range page size is rejected before the key request', async () => {
  const list = vi.fn()

  const result = await listConsoleApiKeys(
    { page_size: 51 },
    { signal: signal(), list, search: vi.fn() }
  )

  expect(result).toMatchObject({
    error: 'page_size must be between 1 and 50.',
  })
  expect(list).not.toHaveBeenCalled()
})

test('an aborted key list throws and does not request keys', async () => {
  const controller = new AbortController()
  controller.abort()
  const list = vi.fn()

  await expect(
    listConsoleApiKeys({}, { signal: controller.signal, list, search: vi.fn() })
  ).rejects.toThrow()
  expect(list).not.toHaveBeenCalled()
})

test('creating a key without a name does not call the API', async () => {
  const create = vi.fn()

  const result = await createConsoleApiKey(
    {},
    {
      signal: signal(),
      nowSeconds,
      create,
      invalidate: vi.fn(),
    }
  )

  expect(result).toMatchObject({ error: 'name is required.' })
  expect(create).not.toHaveBeenCalled()
})

test('creating an unlimited key returns the secret once and stores no separate cap', async () => {
  const created = apiKey('sk-once')
  const create = vi.fn().mockResolvedValue({ success: true, data: created })
  const invalidate = vi.fn().mockResolvedValue(undefined)
  const current = signal()

  const result = await createConsoleApiKey(
    { name: 'launch' },
    { signal: current, nowSeconds, create, invalidate }
  )

  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'launch',
      unlimited_quota: true,
      remain_quota: 0,
      expired_time: -1,
      cross_group_retry: false,
    }),
    current
  )
  expect(result).toMatchObject({ id: 7, key: 'sk-once' })
  expect(invalidate).toHaveBeenCalledOnce()
})

test('a capped key stores the display-dollar amount as quota units', async () => {
  const create = vi.fn().mockResolvedValue({
    success: true,
    data: apiKey('sk-capped'),
  })

  await createConsoleApiKey(
    { name: 'capped', unlimited_quota: false, quota_dollars: 2 },
    {
      signal: signal(),
      nowSeconds,
      create,
      invalidate: vi.fn().mockResolvedValue(undefined),
    }
  )

  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      unlimited_quota: false,
      remain_quota: 1_000_000,
    }),
    expect.any(AbortSignal)
  )
})

test('a key expiry in the past is rejected before creation', async () => {
  const create = vi.fn()

  const result = await createConsoleApiKey(
    { name: 'old', expires_at: nowSeconds - 10 },
    {
      signal: signal(),
      nowSeconds,
      create,
      invalidate: vi.fn(),
    }
  )

  expect(result).toMatchObject({ error: expect.stringContaining('expires_at') })
  expect(create).not.toHaveBeenCalled()
})

test('a failed key creation does not refresh the key list', async () => {
  const invalidate = vi.fn()

  const result = await createConsoleApiKey(
    { name: 'launch' },
    {
      signal: signal(),
      nowSeconds,
      create: vi
        .fn()
        .mockResolvedValue({ success: false, message: 'duplicate' }),
      invalidate,
    }
  )

  expect(result).toEqual({ error: 'duplicate' })
  expect(invalidate).not.toHaveBeenCalled()
})

test('disabling a key sends the disabled status and does not return a secret', async () => {
  const update = vi.fn().mockResolvedValue({
    success: true,
    data: apiKey('sk-hidden'),
  })
  const current = signal()

  const result = await setConsoleApiKeyStatus(
    { id: 7, enabled: false },
    {
      signal: current,
      update,
      invalidate: vi.fn().mockResolvedValue(undefined),
    }
  )

  expect(update).toHaveBeenCalledWith(7, API_KEY_STATUS.DISABLED, current)
  expect(result).toEqual({ id: 7, status: 'disabled' })
  expect(JSON.stringify(result)).not.toContain('sk-hidden')
})

test('deleting a key refreshes the list after the server accepts it', async () => {
  const invalidate = vi.fn().mockResolvedValue(undefined)

  const result = await deleteConsoleApiKey(
    { id: 7 },
    {
      signal: signal(),
      remove: vi.fn().mockResolvedValue({ success: true }),
      invalidate,
    }
  )

  expect(result).toEqual({ id: 7, deleted: true })
  expect(invalidate).toHaveBeenCalledOnce()
})

test('usage log search omits prompt text and client addresses', async () => {
  const getUserLogs = vi.fn().mockResolvedValue({
    success: true,
    data: { items: [usageLog()], total: 1, page: 1, page_size: 20 },
  })

  const result = await searchConsoleUsageLogs(
    { model_name: 'gpt' },
    {
      actor: actor(ROLE.USER),
      signal: signal(),
      getUserLogs,
      getAllLogs: vi.fn(),
    }
  )

  const encoded = JSON.stringify(result)
  expect(encoded).not.toContain('prompt secret')
  expect(encoded).not.toContain('10.1.1.1')
  expect(encoded).not.toContain('up_1')
  expect(result).toMatchObject({
    items: [{ id: 9, model_name: 'gpt', request_id: 'req_1' }],
  })
})

test('a user cannot filter usage logs by username', async () => {
  const getUserLogs = vi.fn()

  const result = await searchConsoleUsageLogs(
    { username: 'ada' },
    {
      actor: actor(ROLE.USER),
      signal: signal(),
      getUserLogs,
      getAllLogs: vi.fn(),
    }
  )

  expect(result).toEqual({
    error: 'Filtering by username or channel requires an administrator.',
  })
  expect(getUserLogs).not.toHaveBeenCalled()
})

test('an administrator usage search can filter by username', async () => {
  const getAllLogs = vi.fn().mockResolvedValue({
    success: true,
    data: { items: [], total: 0, page: 1, page_size: 20 },
  })
  const current = signal()

  await searchConsoleUsageLogs(
    { username: 'ada' },
    {
      actor: actor(ROLE.ADMIN),
      signal: current,
      getUserLogs: vi.fn(),
      getAllLogs,
    }
  )

  expect(getAllLogs).toHaveBeenCalledWith(
    expect.objectContaining({ username: 'ada' }),
    current
  )
})

test('a user cannot list channels', async () => {
  const list = vi.fn()

  const result = await listConsoleChannels(
    {},
    { actor: actor(ROLE.USER), signal: signal(), list }
  )

  expect(result).toEqual({ error: 'This action requires an administrator.' })
  expect(list).not.toHaveBeenCalled()
})

test('channel listings omit upstream credentials', async () => {
  const list = vi.fn().mockResolvedValue({
    success: true,
    data: {
      items: [
        {
          id: 8,
          name: 'primary',
          type: 1,
          status: CHANNEL_STATUS.ENABLED,
          models: 'gpt',
          group: 'default',
          balance: 3,
          key: 'sk-upstream',
          openai_organization: 'org-secret',
          other: 'secret-json',
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    },
  })

  const result = await listConsoleChannels(
    { status: 'enabled' },
    { actor: actor(ROLE.ADMIN), signal: signal(), list }
  )

  const encoded = JSON.stringify(result)
  expect(encoded).not.toContain('sk-upstream')
  expect(encoded).not.toContain('org-secret')
  expect(encoded).not.toContain('secret-json')
  expect(result).toMatchObject({
    items: [{ id: 8, name: 'primary', status_label: 'enabled' }],
  })
})

test('enabling a channel sends the enabled status', async () => {
  const update = vi.fn().mockResolvedValue({ success: true })
  const current = signal()

  const result = await setConsoleChannelStatus(
    { id: 8, enabled: true },
    {
      actor: actor(ROLE.ADMIN),
      signal: current,
      update,
      invalidate: vi.fn().mockResolvedValue(undefined),
    }
  )

  expect(update).toHaveBeenCalledWith(8, CHANNEL_STATUS.ENABLED, current)
  expect(result).toEqual({ id: 8, status: 'enabled' })
})

test('user listings omit passwords and email addresses', async () => {
  const list = vi.fn().mockResolvedValue({
    success: true,
    data: { items: [account()], total: 1, page: 1, page_size: 20 },
  })

  const result = await listConsoleUsers(
    {},
    { actor: actor(ROLE.ADMIN), signal: signal(), list }
  )

  const encoded = JSON.stringify(result)
  expect(encoded).not.toContain('hash')
  expect(encoded).not.toContain('ada@example.com')
  expect(result).toMatchObject({ items: [{ id: 4, username: 'ada' }] })
})

test('model search with a keyword uses the search request', async () => {
  const list = vi.fn()
  const search = vi.fn().mockResolvedValue({
    success: true,
    data: { items: [model()], total: 1, page: 1, page_size: 20 },
  })

  const result = await searchConsoleModels(
    { keyword: 'gpt' },
    { actor: actor(ROLE.ADMIN), signal: signal(), list, search }
  )

  expect(list).not.toHaveBeenCalled()
  expect(search).toHaveBeenCalled()
  expect(result).toMatchObject({ items: [{ id: 5, model_name: 'gpt' }] })
})

test('a user cannot search the admin model catalog', async () => {
  const list = vi.fn()

  const result = await searchConsoleModels(
    {},
    { actor: actor(ROLE.USER), signal: signal(), list, search: vi.fn() }
  )

  expect(result).toEqual({ error: 'This action requires an administrator.' })
  expect(list).not.toHaveBeenCalled()
})
