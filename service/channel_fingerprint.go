package service

import (
	"context"
	"errors"
	"strings"
	"sync"

	lmfpd "github.com/Ikaleio/lm-detector/sdk/go"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

// ChannelFingerprintOptions selects what a channel model fingerprint detection round asks for.
type ChannelFingerprintOptions struct {
	Model string `json:"model"`
	API   string `json:"api"`
}

// ChannelFingerprintResult is one detection round together with the reference data build it was scored against.
type ChannelFingerprintResult struct {
	BuiltAt string              `json:"built_at"`
	Result  *lmfpd.DetectResult `json:"result"`
}

// DetectChannelModelFingerprint sends one round of challenges to the channel upstream and scores the replies.
// The upstream is called directly with the channel base URL and key, so the result does not depend on the relay.
func DetectChannelModelFingerprint(ctx context.Context, channel *model.Channel, options ChannelFingerprintOptions) (*ChannelFingerprintResult, error) {
	config, err := channelFingerprintConfig(channel, options)
	if err != nil {
		return nil, err
	}
	detector, err := loadModelFingerprintDetector(ctx)
	if err != nil {
		return nil, err
	}
	result, err := detector.Detect(ctx, config)
	if err != nil {
		return nil, err
	}
	return &ChannelFingerprintResult{BuiltAt: detector.BuiltAt(), Result: result}, nil
}

var (
	modelFingerprintDetectorMu sync.Mutex
	modelFingerprintDetector   *lmfpd.Detector
)

// loadModelFingerprintDetector keeps the reference bank in memory so a detection round does not parse it again.
// Loading downloads the bank on first use and caches it on disk; the SDK handles both.
func loadModelFingerprintDetector(ctx context.Context) (*lmfpd.Detector, error) {
	modelFingerprintDetectorMu.Lock()
	defer modelFingerprintDetectorMu.Unlock()
	if modelFingerprintDetector != nil {
		return modelFingerprintDetector, nil
	}
	detector, err := lmfpd.Load(ctx, lmfpd.LoadOptions{})
	if err != nil {
		return nil, err
	}
	modelFingerprintDetector = detector
	return detector, nil
}

func channelFingerprintConfig(channel *model.Channel, options ChannelFingerprintOptions) (lmfpd.DetectConfig, error) {
	modelName := strings.TrimSpace(options.Model)
	if modelName == "" {
		return lmfpd.DetectConfig{}, errors.New("model is required")
	}
	api, ok := channelFingerprintAPI(channel, options.API)
	if !ok {
		return lmfpd.DetectConfig{}, errors.New("api must be responses, chat_completions, or messages")
	}
	baseURL := strings.TrimSpace(channel.GetBaseURL())
	if baseURL == "" {
		baseURL = strings.TrimSpace(constant.GetChannelBaseURL(channel.Type))
	}
	if baseURL == "" {
		return lmfpd.DetectConfig{}, errors.New("channel base URL is empty")
	}
	apiKey := channelFingerprintAPIKey(channel)
	if apiKey == "" {
		return lmfpd.DetectConfig{}, errors.New("channel has no enabled API key")
	}
	return lmfpd.DetectConfig{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Model:   modelName,
		API:     api,
	}, nil
}

// channelFingerprintAPI resolves an explicit request protocol, falling back to the protocol that fits the channel type.
func channelFingerprintAPI(channel *model.Channel, rawAPI string) (lmfpd.API, bool) {
	switch strings.TrimSpace(rawAPI) {
	case "responses":
		return lmfpd.APIResponses, true
	case "chat_completions":
		return lmfpd.APIChatCompletions, true
	case "messages":
		return lmfpd.APIMessages, true
	case "":
		if apiType, ok := common.ChannelType2APIType(channel.Type); ok && apiType == constant.APITypeAnthropic {
			return lmfpd.APIMessages, true
		}
		return lmfpd.APIChatCompletions, true
	default:
		return "", false
	}
}

// channelFingerprintAPIKey returns the first enabled key. Disabled multi-key entries are skipped without
// advancing the channel polling index.
func channelFingerprintAPIKey(channel *model.Channel) string {
	keys := channel.GetKeys()
	for index, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if status, ok := channel.ChannelInfo.MultiKeyStatusList[index]; ok && status != common.ChannelStatusEnabled {
			continue
		}
		return key
	}
	return ""
}
