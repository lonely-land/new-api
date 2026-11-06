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
import { Fingerprint, Loader2 } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getServerErrorMessage } from '@/lib/server-error-message'

import { detectChannelFingerprint } from '../../api'
import { parseModelsString } from '../../lib'
import {
  defaultFingerprintApi,
  type ChannelFingerprintResult,
  type FingerprintApi,
} from '../../lib/model-fingerprint'
import { useChannels } from '../channels-provider'
import { ModelFingerprintResult } from '../model-fingerprint-result'

type ModelFingerprintDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModelFingerprintDialog(props: ModelFingerprintDialogProps) {
  const { t } = useTranslation()
  const { currentRow } = useChannels()
  const modelInputId = useId()
  const [model, setModel] = useState('')
  const [api, setApi] = useState<FingerprintApi>('chat_completions')
  const [isDetecting, setIsDetecting] = useState(false)
  const [result, setResult] = useState<ChannelFingerprintResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const channelModels = useMemo(
    () => parseModelsString(currentRow?.models ?? ''),
    [currentRow?.models]
  )
  const modelOptions = useMemo(
    () => channelModels.map((value) => ({ value, label: value })),
    [channelModels]
  )

  useEffect(() => {
    if (!props.open || !currentRow) return
    abortRef.current?.abort()
    abortRef.current = null
    const preferredModel = currentRow.test_model?.trim() || ''
    setModel(preferredModel || channelModels[0] || '')
    setApi(defaultFingerprintApi(currentRow.type))
    setIsDetecting(false)
    setResult(null)
    setErrorMessage(null)
  }, [props.open, currentRow, channelModels])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  if (!currentRow) return null

  const handleDetect = async () => {
    const modelName = model.trim()
    if (!modelName || isDetecting) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsDetecting(true)
    setResult(null)
    setErrorMessage(null)
    try {
      const data = await detectChannelFingerprint(
        currentRow.id,
        { model: modelName, api },
        controller.signal
      )
      setResult(data)
    } catch (error: unknown) {
      if (controller.signal.aborted) return
      setErrorMessage(getServerErrorMessage(error, t('Detection failed')))
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setIsDetecting(false)
      }
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      abortRef.current?.abort()
      abortRef.current = null
      setIsDetecting(false)
    }
    props.onOpenChange(open)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={t('Model Fingerprint Detection')}
      description={
        <>
          {t(
            'Ask the channel upstream to write a few hundred integers, then compare the number patterns with the reference bank.'
          )}{' '}
          <a
            href='https://lm.ikale.io/docs/sdk'
            target='_blank'
            rel='noreferrer'
          >
            {t('Learn more')}
          </a>
        </>
      }
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            {isDetecting ? t('Cancel') : t('Close')}
          </Button>
          <Button
            onClick={handleDetect}
            disabled={isDetecting || model.trim() === ''}
          >
            {isDetecting ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Fingerprint className='size-4' />
            )}
            {isDetecting ? t('Detecting...') : t('Start Detection')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]'>
          <div className='space-y-2'>
            <Label htmlFor={modelInputId}>{t('Model')}</Label>
            <Combobox
              id={modelInputId}
              options={modelOptions}
              value={model}
              onValueChange={(value) => setModel(value ?? '')}
              placeholder={t('Model name')}
              searchPlaceholder={t('Search models')}
              emptyText={t('No matching items')}
              allowCustomValue
              disabled={isDetecting}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('API protocol')}</Label>
            <Select
              items={[
                { value: 'chat_completions', label: t('Chat Completions') },
                { value: 'responses', label: t('Responses') },
                { value: 'messages', label: t('Messages') },
              ]}
              value={api}
              onValueChange={(value) => setApi(value as FingerprintApi)}
              disabled={isDetecting}
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectItem value='chat_completions'>
                    {t('Chat Completions')}
                  </SelectItem>
                  <SelectItem value='responses'>{t('Responses')}</SelectItem>
                  <SelectItem value='messages'>{t('Messages')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isDetecting && (
          <Alert>
            <Loader2 className='animate-spin' />
            <AlertTitle>{t('Detecting...')}</AlertTitle>
            <AlertDescription>
              {t('Detection can take up to two minutes.')}
            </AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert variant='destructive'>
            <AlertTitle>{t('Detection failed')}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {result && <ModelFingerprintResult result={result} />}
      </div>
    </Dialog>
  )
}
