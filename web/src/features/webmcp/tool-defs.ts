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
import { CONSOLE_PAGE_IDS } from './pages'

const readOnly = {
  readOnlyHint: true,
  consequentialHint: false,
  untrustedContentHint: true,
} as const

const consequential = {
  readOnlyHint: false,
  consequentialHint: true,
  untrustedContentHint: false,
} as const

const pageFields = {
  page: {
    type: 'integer',
    minimum: 1,
    maximum: 1000,
    default: 1,
    description: 'Page number.',
  },
  page_size: {
    type: 'integer',
    minimum: 1,
    maximum: 50,
    default: 20,
    description: 'How many records to return.',
  },
} as const

const emptyInput = { type: 'object', properties: {} } as const

export const consoleTools = {
  context: {
    name: 'get_console_context',
    description:
      'Reads the signed-in account, the open console path, and the pages that account can open.',
    inputSchema: emptyInput,
    annotations: readOnly,
  },
  navigate: {
    name: 'navigate_console',
    description: 'Opens a console page the signed-in user is allowed to view.',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: CONSOLE_PAGE_IDS,
          description: 'Console page to open.',
        },
      },
      required: ['page'],
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
      untrustedContentHint: false,
    },
  },
  listKeys: {
    name: 'list_api_keys',
    description:
      'Lists API keys for the signed-in user. Returned records omit key secrets.',
    inputSchema: {
      type: 'object',
      properties: {
        ...pageFields,
        keyword: {
          type: 'string',
          description: 'Name fragment to match.',
        },
      },
    },
    annotations: readOnly,
  },
  createKey: {
    name: 'create_api_key',
    description:
      'Creates an API key for the signed-in user. The new secret is returned once.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name shown in the key list.' },
        unlimited_quota: {
          type: 'boolean',
          default: true,
          description: 'Whether the key has its own spending cap.',
        },
        quota_dollars: {
          type: 'number',
          minimum: 0,
          description:
            'Spending cap in display dollars when the key is capped.',
        },
        expires_at: {
          type: 'integer',
          description: 'Unix time in seconds when the key expires.',
        },
        group: { type: 'string', description: 'Token group.' },
        model_limits: {
          type: 'array',
          items: { type: 'string' },
          description: 'Model names the key may call.',
        },
        allow_ips: {
          type: 'string',
          description: 'IP allowlist text stored on the key.',
        },
      },
      required: ['name'],
    },
    annotations: consequential,
  },
  setKeyStatus: {
    name: 'set_api_key_status',
    description:
      'Enables or disables an API key belonging to the signed-in user.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', minimum: 1, description: 'API key id.' },
        enabled: {
          type: 'boolean',
          description: 'Whether the key should accept requests.',
        },
      },
      required: ['id', 'enabled'],
    },
    annotations: consequential,
  },
  deleteKey: {
    name: 'delete_api_key',
    description: 'Deletes an API key belonging to the signed-in user.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', minimum: 1, description: 'API key id.' },
      },
      required: ['id'],
    },
    annotations: consequential,
  },
  usageLogs: {
    name: 'search_usage_logs',
    description:
      'Searches usage logs visible to the signed-in user. Prompt text is omitted.',
    inputSchema: {
      type: 'object',
      properties: {
        ...pageFields,
        model_name: { type: 'string', description: 'Model name to match.' },
        token_name: { type: 'string', description: 'API key name to match.' },
        username: { type: 'string', description: 'Account name to match.' },
        channel: {
          type: 'integer',
          minimum: 1,
          description: 'Channel id to match.',
        },
        start_timestamp: {
          type: 'integer',
          description: 'Inclusive start, as unix seconds.',
        },
        end_timestamp: {
          type: 'integer',
          description: 'Inclusive end, as unix seconds.',
        },
      },
    },
    annotations: readOnly,
  },
  listChannels: {
    name: 'list_channels',
    description:
      'Lists upstream channels an administrator can manage. Upstream credentials are omitted.',
    inputSchema: {
      type: 'object',
      properties: {
        ...pageFields,
        status: {
          type: 'string',
          enum: ['enabled', 'disabled', 'all'],
          default: 'all',
          description: 'Which channels to include.',
        },
      },
    },
    annotations: readOnly,
  },
  setChannelStatus: {
    name: 'set_channel_status',
    description: 'Enables or disables an upstream channel.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', minimum: 1, description: 'Channel id.' },
        enabled: {
          type: 'boolean',
          description: 'Whether the channel should receive traffic.',
        },
      },
      required: ['id', 'enabled'],
    },
    annotations: consequential,
  },
  listUsers: {
    name: 'list_users',
    description:
      'Lists accounts an administrator can manage. Passwords and contact details are omitted.',
    inputSchema: { type: 'object', properties: pageFields },
    annotations: readOnly,
  },
  searchModels: {
    name: 'search_models',
    description: 'Searches the model catalog an administrator can manage.',
    inputSchema: {
      type: 'object',
      properties: {
        ...pageFields,
        keyword: {
          type: 'string',
          description: 'Model name fragment to match.',
        },
      },
    },
    annotations: readOnly,
  },
} as const
