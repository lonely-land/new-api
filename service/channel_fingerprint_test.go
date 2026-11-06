package service

import (
	"testing"

	lmfpd "github.com/Ikaleio/lm-detector/sdk/go"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelFingerprintConfig(t *testing.T) {
	tests := []struct {
		name    string
		channel *model.Channel
		options ChannelFingerprintOptions
		want    lmfpd.DetectConfig
		wantErr string
	}{
		{
			name: "openai channel defaults to chat completions",
			channel: &model.Channel{
				Type:    constant.ChannelTypeOpenAI,
				Key:     "sk-test",
				BaseURL: common.GetPointer(""),
			},
			options: ChannelFingerprintOptions{Model: "gpt-5"},
			want: lmfpd.DetectConfig{
				BaseURL: constant.GetChannelBaseURL(constant.ChannelTypeOpenAI),
				APIKey:  "sk-test",
				Model:   "gpt-5",
				API:     lmfpd.APIChatCompletions,
			},
		},
		{
			name: "anthropic channel defaults to messages",
			channel: &model.Channel{
				Type:    constant.ChannelTypeAnthropic,
				Key:     "sk-ant-test",
				BaseURL: common.GetPointer("https://anthropic.example"),
			},
			options: ChannelFingerprintOptions{Model: "claude-sonnet-5"},
			want: lmfpd.DetectConfig{
				BaseURL: "https://anthropic.example",
				APIKey:  "sk-ant-test",
				Model:   "claude-sonnet-5",
				API:     lmfpd.APIMessages,
			},
		},
		{
			name: "explicit protocol overrides the channel default",
			channel: &model.Channel{
				Type:    constant.ChannelTypeOpenAI,
				Key:     "sk-test",
				BaseURL: common.GetPointer("https://api.example/v1"),
			},
			options: ChannelFingerprintOptions{Model: "gpt-5", API: "responses"},
			want: lmfpd.DetectConfig{
				BaseURL: "https://api.example/v1",
				APIKey:  "sk-test",
				Model:   "gpt-5",
				API:     lmfpd.APIResponses,
			},
		},
		{
			name: "disabled multi-key entries are skipped",
			channel: &model.Channel{
				Type:    constant.ChannelTypeOpenAI,
				Key:     "sk-disabled\nsk-enabled",
				BaseURL: common.GetPointer(""),
				ChannelInfo: model.ChannelInfo{
					IsMultiKey:         true,
					MultiKeyStatusList: map[int]int{0: common.ChannelStatusManuallyDisabled},
				},
			},
			options: ChannelFingerprintOptions{Model: "gpt-5"},
			want: lmfpd.DetectConfig{
				BaseURL: constant.GetChannelBaseURL(constant.ChannelTypeOpenAI),
				APIKey:  "sk-enabled",
				Model:   "gpt-5",
				API:     lmfpd.APIChatCompletions,
			},
		},
		{
			name: "model is required",
			channel: &model.Channel{
				Type:    constant.ChannelTypeOpenAI,
				Key:     "sk-test",
				BaseURL: common.GetPointer(""),
			},
			options: ChannelFingerprintOptions{},
			wantErr: "model is required",
		},
		{
			name: "unknown protocol is rejected",
			channel: &model.Channel{
				Type:    constant.ChannelTypeOpenAI,
				Key:     "sk-test",
				BaseURL: common.GetPointer(""),
			},
			options: ChannelFingerprintOptions{Model: "gpt-5", API: "completions"},
			wantErr: "api must be responses, chat_completions, or messages",
		},
		{
			name: "empty base URL is rejected",
			channel: &model.Channel{
				Type: constant.ChannelTypeNewAPI,
				Key:  "sk-test",
			},
			options: ChannelFingerprintOptions{Model: "gpt-5"},
			wantErr: "channel base URL is empty",
		},
		{
			name: "missing key is rejected",
			channel: &model.Channel{
				Type:    constant.ChannelTypeOpenAI,
				BaseURL: common.GetPointer(""),
			},
			options: ChannelFingerprintOptions{Model: "gpt-5"},
			wantErr: "channel has no enabled API key",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			config, err := channelFingerprintConfig(test.channel, test.options)
			if test.wantErr != "" {
				require.ErrorContains(t, err, test.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.want, config)
		})
	}
}
