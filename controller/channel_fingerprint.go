package controller

import (
	"context"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// DetectChannelModelFingerprint sends a fingerprint detection round to the channel upstream and returns the ranking.
// The round can take up to two minutes because the upstream generates three replies; the handler does not stream progress.
func DetectChannelModelFingerprint(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "Invalid channel id")
		return
	}
	var options service.ChannelFingerprintOptions
	if err := c.ShouldBindJSON(&options); err != nil {
		common.ApiErrorMsg(c, "Invalid request parameters")
		return
	}
	channel, err := model.GetChannelById(channelId, true)
	if err != nil {
		common.ApiErrorMsg(c, "Channel not found")
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Minute)
	defer cancel()
	result, err := service.DetectChannelModelFingerprint(ctx, channel, options)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
