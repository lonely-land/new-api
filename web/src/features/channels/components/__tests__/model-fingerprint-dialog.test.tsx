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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import type { ChannelFingerprintResult } from '../../lib/model-fingerprint'
import { channelSchema, type Channel } from '../../types'
import { ChannelsProvider, useChannels } from '../channels-provider'
import { ModelFingerprintDialog } from '../dialogs/model-fingerprint-dialog'

const fingerprintResult: ChannelFingerprintResult = {
  built_at: '2026-11-03T12:06:39.864352+00:00',
  result: {
    challenges: [
      { id: 'c1', expected_count: 314, prompt: 'challenge one' },
      { id: 'c2', expected_count: 328, prompt: 'challenge two' },
      { id: 'c3', expected_count: 304, prompt: 'challenge three' },
    ],
    samples: [
      {
        state: 'complete',
        text: '47 203',
        raw_text: '47 203',
        count: 241,
        expected_count: 314,
        first_byte_ms: 120,
        response_model: 'claude-haiku-4.5',
        response_id: 'resp-1',
        error: null,
      },
      {
        state: 'complete',
        text: '47 289',
        raw_text: '47 289',
        count: 218,
        expected_count: 328,
        first_byte_ms: 140,
        response_model: 'claude-haiku-4.5',
        response_id: 'resp-2',
        error: null,
      },
      {
        state: 'truncated',
        text: '47 289',
        raw_text: '47 289',
        count: 239,
        expected_count: 304,
        first_byte_ms: 130,
        response_model: 'claude-haiku-4.5',
        response_id: 'resp-3',
        error: null,
      },
    ],
    analysis: {
      decision: 'scored',
      prediction: 'claude-haiku-4.5',
      prediction_name: 'claude-haiku-4.5',
      family_prediction: 'claude',
      family_prediction_name: 'Claude',
      results: [
        {
          model: 'claude-haiku-4.5',
          display_name: 'claude-haiku-4.5',
          family: 'claude',
          family_name: 'Claude',
          score: 4.852,
          probability: 0.9999,
        },
        {
          model: 'deepseek-v3.2',
          display_name: 'deepseek-v3.2',
          family: 'deepseek',
          family_name: 'DeepSeek',
          score: 1.372,
          probability: 0.0001,
        },
      ],
      probability: 0.9999,
      probability_status: 'reference_calibrated',
      used_outputs: 3,
      method: 'rank',
      evidence: {
        label: 'calibrated',
        reason: '',
        insufficient: false,
      },
    },
    error: null,
  },
}

function DialogHarness(props: { channel: Channel }) {
  const [open, setOpen] = useState(true)
  const { setCurrentRow } = useChannels()
  useEffect(() => {
    setCurrentRow(props.channel)
  }, [props.channel, setCurrentRow])
  return <ModelFingerprintDialog open={open} onOpenChange={setOpen} />
}

let client: QueryClient
let channel: Channel

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  channel = channelSchema.parse({
    id: 42,
    name: 'Fingerprint channel',
    type: 1,
    key: '',
    status: 1,
    created_time: 1,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
    models: 'gpt-5, gpt-5-mini',
    test_model: 'gpt-5',
    group: 'default',
    base_url: 'https://api.example/v1',
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
})

test('starting detection posts the selected model and shows the ranking', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: fingerprintResult },
  })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        <DialogHarness channel={channel} />
      </ChannelsProvider>
    </QueryClientProvider>
  )

  expect(screen.getByRole('dialog')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Start Detection' }))

  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
  expect(post).toHaveBeenCalledWith(
    '/api/channel/42/fingerprint',
    { model: 'gpt-5', api: 'chat_completions' },
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  )
  expect(await screen.findByText('Scored')).toBeVisible()
  expect(screen.getAllByText('claude-haiku-4.5').length).toBeGreaterThan(0)
  expect(screen.getAllByText('99.99%').length).toBeGreaterThan(0)
  expect(screen.getByText('DeepSeek')).toBeVisible()
})

test('a failed detection request is shown in the dialog', async () => {
  vi.spyOn(api, 'post').mockRejectedValue({
    response: {
      data: { success: false, message: 'reference data unavailable' },
    },
  })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        <DialogHarness channel={channel} />
      </ChannelsProvider>
    </QueryClientProvider>
  )

  await user.click(screen.getByRole('button', { name: 'Start Detection' }))

  expect(await screen.findByText('Detection failed')).toBeVisible()
  expect(screen.getByText('reference data unavailable')).toBeVisible()
})
