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
import type { useNavigate } from '@tanstack/react-router'

import { ROLE } from '@/lib/roles'

const CONSOLE_PAGES = [
  {
    id: 'playground',
    access: 'user',
    href: '/playground',
    description: 'Open the model playground.',
  },
  {
    id: 'dashboard-overview',
    access: 'user',
    href: '/dashboard/overview',
    description: 'Open the usage overview.',
  },
  {
    id: 'dashboard-models',
    access: 'user',
    href: '/dashboard/models',
    description: 'Open model call analytics.',
  },
  {
    id: 'dashboard-flow',
    access: 'user',
    href: '/dashboard/flow',
    description: 'Open request flow analytics.',
  },
  {
    id: 'dashboard-users',
    access: 'admin',
    href: '/dashboard/users',
    description: 'Open user analytics.',
  },
  {
    id: 'keys',
    access: 'user',
    href: '/keys',
    description: 'Open API key management.',
  },
  {
    id: 'usage-logs',
    access: 'user',
    href: '/usage-logs/common',
    description: 'Open common usage logs.',
  },
  {
    id: 'audit-logs',
    access: 'user',
    href: '/usage-logs/audit',
    description: 'Open audit logs.',
  },
  {
    id: 'drawing-logs',
    access: 'user',
    href: '/usage-logs/drawing',
    description: 'Open drawing task logs.',
  },
  {
    id: 'task-logs',
    access: 'user',
    href: '/usage-logs/task',
    description: 'Open async task logs.',
  },
  {
    id: 'wallet',
    access: 'user',
    href: '/wallet',
    description: 'Open the wallet.',
  },
  {
    id: 'profile',
    access: 'user',
    href: '/profile',
    description: 'Open the profile.',
  },
  {
    id: 'security',
    access: 'user',
    href: '/security',
    description: 'Open security and access settings.',
  },
  {
    id: 'channels',
    access: 'admin',
    href: '/channels',
    description: 'Open upstream channels.',
  },
  {
    id: 'models',
    access: 'admin',
    href: '/models/metadata',
    description: 'Open model metadata.',
  },
  {
    id: 'model-vendors',
    access: 'admin',
    href: '/models/vendors',
    description: 'Open model vendors.',
  },
  {
    id: 'model-deployments',
    access: 'admin',
    href: '/models/deployments',
    description: 'Open model deployments.',
  },
  {
    id: 'users',
    access: 'admin',
    href: '/users',
    description: 'Open user management.',
  },
  {
    id: 'redemption-codes',
    access: 'admin',
    href: '/redemption-codes',
    description: 'Open redemption codes.',
  },
  {
    id: 'subscriptions',
    access: 'admin',
    href: '/subscriptions',
    description: 'Open subscriptions.',
  },
  {
    id: 'system-info',
    access: 'root',
    href: '/system-info',
    description: 'Open system information.',
  },
  {
    id: 'task-plugins',
    access: 'root',
    href: '/task-plugins',
    description: 'Open task plugins.',
  },
  {
    id: 'settings-site',
    access: 'root',
    href: '/system-settings/site',
    description: 'Open site settings.',
  },
  {
    id: 'settings-auth',
    access: 'root',
    href: '/system-settings/auth',
    description: 'Open authentication settings.',
  },
  {
    id: 'settings-billing',
    access: 'root',
    href: '/system-settings/billing',
    description: 'Open billing settings.',
  },
  {
    id: 'settings-content',
    access: 'root',
    href: '/system-settings/content',
    description: 'Open content settings.',
  },
  {
    id: 'settings-operations',
    access: 'root',
    href: '/system-settings/operations',
    description: 'Open operations settings.',
  },
  {
    id: 'settings-security',
    access: 'root',
    href: '/system-settings/security',
    description: 'Open security settings.',
  },
  {
    id: 'settings-models',
    access: 'root',
    href: '/system-settings/models',
    description: 'Open model settings.',
  },
  {
    id: 'settings-request-policies',
    access: 'root',
    href: '/system-settings/request-policies',
    description: 'Open request policy settings.',
  },
] as const

export type ConsolePage = (typeof CONSOLE_PAGES)[number]
export type ConsolePageId = ConsolePage['id']

export const CONSOLE_PAGE_IDS = CONSOLE_PAGES.map((page) => page.id)

export function findConsolePage(id: string): ConsolePage | undefined {
  return CONSOLE_PAGES.find((page) => page.id === id)
}

export function canOpenConsolePage(role: number, page: ConsolePage): boolean {
  if (page.access === 'root') return role === ROLE.SUPER_ADMIN
  if (page.access === 'admin') return role >= ROLE.ADMIN
  return role >= ROLE.USER
}

export function pagesForRole(role: number) {
  return CONSOLE_PAGES.filter((page) => canOpenConsolePage(role, page)).map(
    (page) => ({
      id: page.id,
      path: page.href,
      description: page.description,
    })
  )
}

type AppNavigate = ReturnType<typeof useNavigate>

export async function openConsolePage(
  navigate: AppNavigate,
  pageId: ConsolePageId
): Promise<void> {
  switch (pageId) {
    case 'playground':
      await navigate({ to: '/playground' })
      return
    case 'dashboard-overview':
      await navigate({
        to: '/dashboard/$section',
        params: { section: 'overview' },
      })
      return
    case 'dashboard-models':
      await navigate({
        to: '/dashboard/$section',
        params: { section: 'models' },
      })
      return
    case 'dashboard-flow':
      await navigate({
        to: '/dashboard/$section',
        params: { section: 'flow' },
      })
      return
    case 'dashboard-users':
      await navigate({
        to: '/dashboard/$section',
        params: { section: 'users' },
      })
      return
    case 'keys':
      await navigate({ to: '/keys' })
      return
    case 'usage-logs':
      await navigate({
        to: '/usage-logs/$section',
        params: { section: 'common' },
      })
      return
    case 'audit-logs':
      await navigate({ to: '/usage-logs/audit' })
      return
    case 'drawing-logs':
      await navigate({
        to: '/usage-logs/$section',
        params: { section: 'drawing' },
      })
      return
    case 'task-logs':
      await navigate({
        to: '/usage-logs/$section',
        params: { section: 'task' },
      })
      return
    case 'wallet':
      await navigate({ to: '/wallet' })
      return
    case 'profile':
      await navigate({ to: '/profile' })
      return
    case 'security':
      await navigate({ to: '/security' })
      return
    case 'channels':
      await navigate({ to: '/channels' })
      return
    case 'models':
      await navigate({
        to: '/models/$section',
        params: { section: 'metadata' },
      })
      return
    case 'model-vendors':
      await navigate({
        to: '/models/$section',
        params: { section: 'vendors' },
      })
      return
    case 'model-deployments':
      await navigate({
        to: '/models/$section',
        params: { section: 'deployments' },
      })
      return
    case 'users':
      await navigate({ to: '/users' })
      return
    case 'redemption-codes':
      await navigate({ to: '/redemption-codes' })
      return
    case 'subscriptions':
      await navigate({ to: '/subscriptions' })
      return
    case 'system-info':
      await navigate({ to: '/system-info' })
      return
    case 'task-plugins':
      await navigate({ to: '/task-plugins' })
      return
    case 'settings-site':
      await navigate({ to: '/system-settings/site' })
      return
    case 'settings-auth':
      await navigate({ to: '/system-settings/auth' })
      return
    case 'settings-billing':
      await navigate({ to: '/system-settings/billing' })
      return
    case 'settings-content':
      await navigate({ to: '/system-settings/content' })
      return
    case 'settings-operations':
      await navigate({ to: '/system-settings/operations' })
      return
    case 'settings-security':
      await navigate({ to: '/system-settings/security' })
      return
    case 'settings-models':
      await navigate({ to: '/system-settings/models' })
      return
    case 'settings-request-policies':
      await navigate({ to: '/system-settings/request-policies' })
      return
    default: {
      const unreachable: never = pageId
      return unreachable
    }
  }
}
