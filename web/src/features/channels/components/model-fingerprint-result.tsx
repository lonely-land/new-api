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
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import type {
  ChannelFingerprintResult,
  FingerprintDecision,
  FingerprintSample,
  FingerprintSampleState,
} from '../lib/model-fingerprint'

const DECISION_BADGE_VARIANTS: Record<
  FingerprintDecision,
  'default' | 'warning' | 'outline'
> = {
  scored: 'default',
  partial: 'warning',
  unscorable: 'outline',
  not_model: 'warning',
}

const SAMPLE_BADGE_VARIANTS: Record<
  FingerprintSampleState,
  'secondary' | 'warning' | 'destructive' | 'outline'
> = {
  queued: 'outline',
  waiting: 'outline',
  streaming: 'outline',
  complete: 'secondary',
  truncated: 'warning',
  failed: 'destructive',
  cancelled: 'outline',
}

type ModelFingerprintResultProps = {
  result: ChannelFingerprintResult
}

export function ModelFingerprintResult(props: ModelFingerprintResultProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 2,
  })
  const round = props.result.result
  const analysis = round.analysis

  return (
    <div className='space-y-4'>
      {analysis ? (
        <>
          <div className='rounded-lg border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div className='min-w-0 space-y-1'>
                <p className='text-muted-foreground text-xs'>
                  {t('Prediction')}
                </p>
                <p className='truncate text-lg font-semibold'>
                  {analysis.prediction_name || analysis.prediction || '-'}
                </p>
                {analysis.prediction &&
                  analysis.prediction !== analysis.prediction_name && (
                    <p className='text-muted-foreground truncate text-xs'>
                      {analysis.prediction}
                    </p>
                  )}
                <p className='text-muted-foreground text-xs'>
                  {t('Family')}:{' '}
                  {analysis.family_prediction_name ||
                    analysis.family_prediction ||
                    '-'}
                </p>
              </div>
              <div className='flex shrink-0 flex-col items-end gap-1'>
                <Badge variant={DECISION_BADGE_VARIANTS[analysis.decision]}>
                  {decisionLabel(analysis.decision, t)}
                </Badge>
                {analysis.probability != null && (
                  <>
                    <span className='text-lg font-semibold'>
                      {percent.format(analysis.probability)}
                    </span>
                    <span className='text-muted-foreground text-xs'>
                      {t('Probability')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {analysis.results.length > 0 && (
            <div className='space-y-2'>
              <p className='text-sm font-medium'>{t('Ranking')}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Model')}</TableHead>
                    <TableHead>{t('Family')}</TableHead>
                    <TableHead className='text-end'>{t('Score')}</TableHead>
                    <TableHead className='text-end'>
                      {t('Probability')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.results.slice(0, 5).map((candidate) => (
                    <TableRow key={candidate.model}>
                      <TableCell className='max-w-52 truncate'>
                        {candidate.display_name || candidate.model}
                      </TableCell>
                      <TableCell className='text-muted-foreground max-w-40 truncate'>
                        {candidate.family_name || candidate.family || '-'}
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {formatNumber(candidate.score, locale)}
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {candidate.probability == null
                          ? '-'
                          : percent.format(candidate.probability)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {analysis.decision !== 'scored' && (
            <p className='text-muted-foreground text-xs'>
              {decisionHint(analysis.decision, t)}
            </p>
          )}
        </>
      ) : (
        <Alert variant={round.error ? 'destructive' : 'default'}>
          <AlertTitle>{t('No ranking')}</AlertTitle>
          <AlertDescription>
            {round.error ||
              t('This detection round did not produce a ranking.')}
          </AlertDescription>
        </Alert>
      )}

      {round.samples.length > 0 && (
        <div className='space-y-2'>
          <p className='text-sm font-medium'>{t('Samples')}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Sample')}</TableHead>
                <TableHead>{t('State')}</TableHead>
                <TableHead className='text-end'>{t('Numbers')}</TableHead>
                <TableHead className='text-end'>{t('First byte')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {round.samples.map((sample, index) => (
                <TableRow key={sample.expected_count}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Badge variant={SAMPLE_BADGE_VARIANTS[sample.state]}>
                      {sampleStateLabel(sample.state, t)}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {sampleNumbers(sample)}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {sample.first_byte_ms == null
                      ? '-'
                      : `${formatNumber(sample.first_byte_ms, locale)} ms`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {round.samples.some((sample) => sample.error) && (
            <div className='space-y-1'>
              {round.samples.map((sample, index) =>
                sample.error ? (
                  <p
                    key={`${sample.expected_count}-error`}
                    className='text-destructive text-xs break-words'
                  >
                    {t('Sample {{index}}', { index: index + 1 })}:{' '}
                    {sample.error}
                  </p>
                ) : null
              )}
            </div>
          )}
        </div>
      )}

      <div className='space-y-1'>
        <p className='text-muted-foreground text-xs'>
          {t(
            'The result ranks candidates within the reference bank and is not proof of model identity.'
          )}
        </p>
        {props.result.built_at && (
          <p className='text-muted-foreground text-xs'>
            {t('Reference data')}: {props.result.built_at}
          </p>
        )}
      </div>
    </div>
  )
}

function decisionLabel(decision: FingerprintDecision, t: TFunction): string {
  switch (decision) {
    case 'scored':
      return t('Scored')
    case 'partial':
      return t('Partial')
    case 'unscorable':
      return t('Unscorable')
    case 'not_model':
      return t('Not a model')
    default:
      return decision
  }
}

function decisionHint(decision: FingerprintDecision, t: TFunction): string {
  switch (decision) {
    case 'partial':
      return t(
        'Fewer than three replies were valid, so the result is a ranking without a probability.'
      )
    case 'unscorable':
      return t('Not enough valid replies were returned to produce a ranking.')
    case 'not_model':
      return t(
        'The replies do not look like they were written by a language model.'
      )
    default:
      return ''
  }
}

function sampleStateLabel(state: FingerprintSampleState, t: TFunction): string {
  switch (state) {
    case 'queued':
      return t('Queued')
    case 'waiting':
      return t('Waiting')
    case 'streaming':
      return t('Streaming')
    case 'complete':
      return t('Complete')
    case 'truncated':
      return t('Truncated')
    case 'failed':
      return t('Failed')
    case 'cancelled':
      return t('Cancelled')
    default:
      return state
  }
}

function sampleNumbers(sample: FingerprintSample): string {
  return `${sample.count}/${sample.expected_count}`
}
