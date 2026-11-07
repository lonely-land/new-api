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
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useWebMCP } from 'use-webmcp-tool'

import { getChannels, updateChannelStatus } from '@/features/channels/api'
import {
  createApiKey,
  deleteApiKey,
  getApiKeys,
  searchApiKeys,
  updateApiKeyStatus,
} from '@/features/keys/api'
import { getModels, searchModels } from '@/features/models/api'
import { getAllLogs, getUserLogs } from '@/features/usage-logs/api'
import { getUsers } from '@/features/users/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

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
} from './actions'
import { openConsolePage } from './pages'
import { consoleTools } from './tool-defs'

export function ConsoleWebMcp() {
  const user = useAuthStore((state) => state.auth.user)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const actor = user ? toConsoleActor(user) : null
  const signedIn = actor != null
  const admin = (actor?.role ?? 0) >= ROLE.ADMIN

  useWebMCP({
    ...consoleTools.context,
    enabled: signedIn,
    execute(_input, options) {
      options.signal.throwIfAborted()
      if (!actor) return { error: 'Sign in to use the console.' }
      return readConsoleContext(actor, pathname)
    },
  })

  useWebMCP({
    ...consoleTools.navigate,
    enabled: signedIn,
    async execute(input, options) {
      if (!actor) return { error: 'Sign in to use the console.' }
      return navigateConsole(input, {
        actor,
        signal: options.signal,
        open: (pageId) => openConsolePage(navigate, pageId),
      })
    },
  })

  useWebMCP({
    ...consoleTools.listKeys,
    enabled: signedIn,
    execute(input, options) {
      return listConsoleApiKeys(input, {
        signal: options.signal,
        list: getApiKeys,
        search: (params, signal) => searchApiKeys(params, signal),
      })
    },
  })

  useWebMCP({
    ...consoleTools.createKey,
    enabled: signedIn,
    execute(input, options) {
      return createConsoleApiKey(input, {
        signal: options.signal,
        nowSeconds: Math.floor(Date.now() / 1000),
        create: createApiKey,
        invalidate: () => queryClient.invalidateQueries({ queryKey: ['keys'] }),
      })
    },
  })

  useWebMCP({
    ...consoleTools.setKeyStatus,
    enabled: signedIn,
    execute(input, options) {
      return setConsoleApiKeyStatus(input, {
        signal: options.signal,
        update: updateApiKeyStatus,
        invalidate: () => queryClient.invalidateQueries({ queryKey: ['keys'] }),
      })
    },
  })

  useWebMCP({
    ...consoleTools.deleteKey,
    enabled: signedIn,
    execute(input, options) {
      return deleteConsoleApiKey(input, {
        signal: options.signal,
        remove: deleteApiKey,
        invalidate: () => queryClient.invalidateQueries({ queryKey: ['keys'] }),
      })
    },
  })

  useWebMCP({
    ...consoleTools.usageLogs,
    enabled: signedIn,
    execute(input, options) {
      if (!actor) return { error: 'Sign in to use the console.' }
      return searchConsoleUsageLogs(input, {
        actor,
        signal: options.signal,
        getUserLogs,
        getAllLogs,
      })
    },
  })

  useWebMCP({
    ...consoleTools.listChannels,
    enabled: admin,
    execute(input, options) {
      if (!actor) return { error: 'Sign in to use the console.' }
      return listConsoleChannels(input, {
        actor,
        signal: options.signal,
        list: getChannels,
      })
    },
  })

  useWebMCP({
    ...consoleTools.setChannelStatus,
    enabled: admin,
    execute(input, options) {
      if (!actor) return { error: 'Sign in to use the console.' }
      return setConsoleChannelStatus(input, {
        actor,
        signal: options.signal,
        update: updateChannelStatus,
        invalidate: () =>
          queryClient.invalidateQueries({ queryKey: ['channels'] }),
      })
    },
  })

  useWebMCP({
    ...consoleTools.listUsers,
    enabled: admin,
    execute(input, options) {
      if (!actor) return { error: 'Sign in to use the console.' }
      return listConsoleUsers(input, {
        actor,
        signal: options.signal,
        list: getUsers,
      })
    },
  })

  useWebMCP({
    ...consoleTools.searchModels,
    enabled: admin,
    execute(input, options) {
      if (!actor) return { error: 'Sign in to use the console.' }
      return searchConsoleModels(input, {
        actor,
        signal: options.signal,
        list: getModels,
        search: searchModels,
      })
    },
  })

  return null
}
