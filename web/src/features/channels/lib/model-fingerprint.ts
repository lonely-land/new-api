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

// Model fingerprint detection types mirror the lmfpd SDK JSON result returned by
// POST /api/channel/:id/fingerprint.

import { CHANNEL_TYPE_ANTHROPIC } from '../constants'

export type FingerprintApi = 'responses' | 'chat_completions' | 'messages'

export type FingerprintDecision =
  | 'scored'
  | 'partial'
  | 'unscorable'
  | 'not_model'

export type FingerprintCandidate = {
  model: string
  display_name: string
  family: string
  family_name: string
  score: number
  probability: number | null
}

export type FingerprintAnalysis = {
  decision: FingerprintDecision
  prediction: string
  prediction_name: string
  family_prediction: string
  family_prediction_name: string
  results: FingerprintCandidate[]
  probability: number | null
  probability_status: string
  used_outputs: number
  method: string
  evidence: {
    label: string
    reason: string
    insufficient: boolean
  }
}

export type FingerprintSampleState =
  | 'queued'
  | 'waiting'
  | 'streaming'
  | 'complete'
  | 'truncated'
  | 'failed'
  | 'cancelled'

export type FingerprintSample = {
  state: FingerprintSampleState
  text: string
  raw_text: string
  count: number
  expected_count: number
  first_byte_ms: number | null
  response_model: string | null
  response_id: string | null
  error: string | null
}

export type FingerprintChallenge = {
  id: string
  expected_count: number
  prompt: string
}

export type FingerprintDetectResult = {
  challenges: FingerprintChallenge[]
  samples: FingerprintSample[]
  analysis: FingerprintAnalysis | null
  error: string | null
}

export type ChannelFingerprintResult = {
  built_at: string
  result: FingerprintDetectResult
}

// Anthropic channels speak the Messages API; every other channel type is treated
// as OpenAI-compatible. Users can still pick another protocol in the dialog.
export function defaultFingerprintApi(channelType: number): FingerprintApi {
  return channelType === CHANNEL_TYPE_ANTHROPIC
    ? 'messages'
    : 'chat_completions'
}
