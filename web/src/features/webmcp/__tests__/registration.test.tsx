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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import { ROLE } from '@/lib/roles'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'

import { ConsoleWebMcp } from '../console-web-mcp'

type RegisteredTool = {
  name: string
  annotations?: {
    readOnlyHint?: boolean
    consequentialHint?: boolean
  }
  execute: (
    input: Record<string, unknown>,
    options: { signal: AbortSignal }
  ) => Promise<{ content?: Array<{ text?: string }>; isError?: boolean }>
}

const userTools = [
  'get_console_context',
  'navigate_console',
  'list_api_keys',
  'create_api_key',
  'set_api_key_status',
  'delete_api_key',
  'search_usage_logs',
]

const adminTools = [
  ...userTools,
  'list_channels',
  'set_channel_status',
  'list_users',
  'search_models',
]

const baseUser: AuthUser = {
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

function signIn(role: number) {
  useAuthStore.setState({
    auth: {
      ...useAuthStore.getState().auth,
      user: { ...baseUser, role },
      accessToken: 'secret-token',
    },
  })
}

function installModelContext() {
  const tools = new Map<string, RegisteredTool>()
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: {
      registerTool(tool: RegisteredTool) {
        tools.set(tool.name, tool)
        return Promise.resolve()
      },
    },
  })
  return tools
}

function renderConsole() {
  const rootRoute = createRootRoute({
    component: () => <ConsoleWebMcp />,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const keysRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/keys',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, keysRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { router, client }
}

function toolText(result: {
  content?: Array<{ text?: string }>
}): Record<string, unknown> {
  const text = result.content?.[0]?.text
  if (!text) return {}
  return JSON.parse(text) as Record<string, unknown>
}

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(document, 'modelContext')
  useAuthStore.getState().auth.reset()
})

test('a signed-in user gets console tools except administrator actions', async () => {
  const tools = installModelContext()
  signIn(ROLE.USER)
  renderConsole()

  await waitFor(() => {
    expect([...tools.keys()].sort()).toEqual([...userTools].sort())
  })
  expect(tools.get('delete_api_key')?.annotations).toMatchObject({
    consequentialHint: true,
    readOnlyHint: false,
  })
  expect(tools.get('list_api_keys')?.annotations).toMatchObject({
    readOnlyHint: true,
  })
})

test('an administrator also gets channel, user, and model tools', async () => {
  const tools = installModelContext()
  signIn(ROLE.ADMIN)
  renderConsole()

  await waitFor(() => {
    expect([...tools.keys()].sort()).toEqual([...adminTools].sort())
  })
})

test('console context omits the session token and email address', async () => {
  const tools = installModelContext()
  signIn(ROLE.USER)
  renderConsole()

  await waitFor(() => {
    expect(tools.has('get_console_context')).toBe(true)
  })
  const result = await tools
    .get('get_console_context')
    ?.execute({}, { signal: new AbortController().signal })
  const body = toolText(result ?? {})
  const encoded = JSON.stringify(body)

  expect(body).toMatchObject({
    path: '/',
    user: { username: 'rain', role_name: 'user' },
  })
  expect(encoded).not.toContain('secret-token')
  expect(encoded).not.toContain('rain@example.com')
})

test('navigating to keys changes the open console page', async () => {
  const tools = installModelContext()
  signIn(ROLE.USER)
  const { router } = renderConsole()

  await waitFor(() => {
    expect(tools.has('navigate_console')).toBe(true)
  })
  const result = await tools
    .get('navigate_console')
    ?.execute({ page: 'keys' }, { signal: new AbortController().signal })

  expect(toolText(result ?? {})).toMatchObject({ page: 'keys', path: '/keys' })
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/keys')
  })
})

test('a user cannot navigate to channels from the registered tool', async () => {
  const tools = installModelContext()
  signIn(ROLE.USER)
  const { router } = renderConsole()

  await waitFor(() => {
    expect(tools.has('navigate_console')).toBe(true)
  })
  const result = await tools
    .get('navigate_console')
    ?.execute({ page: 'channels' }, { signal: new AbortController().signal })

  expect(toolText(result ?? {})).toMatchObject({
    error: 'This action requires an administrator.',
  })
  expect(router.state.location.pathname).toBe('/')
})
