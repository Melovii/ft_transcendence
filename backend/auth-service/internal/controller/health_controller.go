package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ContractVersion is the served REST API v1 revision, matching the collection
// metadata in the bruno contract (collections/v1/rest-api/00 - Contract &
// Health/health.yml). Bump it in lockstep with the contract collection.
const ContractVersion = "1.2.0-dev"

// Health handles GET /api/v1/health.
//
// The contract is explicit about what this endpoint proves: the HTTP process
// is reachable and declares the contract version it serves. It is not a
// readiness probe — a successful response does not assert that persistence or
// the realtime subsystems are healthy; callers that need that use the
// orchestrator-facing probes (/healthz and friends) or the status service.
//
// It writes HTTP 200 with the normal success envelope and returns nil.
func Health(c *gin.Context) error {
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"status":           "OK",
		"contract_version": ContractVersion,
		"server_time":      time.Now().UTC().Format(time.RFC3339),
	}})
	return nil
}