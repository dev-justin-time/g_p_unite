/**
 * FCM Agent — Common configuration module
 *
 * Shared environment variables and labels for all agent containers.
 * Used by AWS, Hetzner, and Azure modules.
 */

locals {
  agent_labels = {
    "fcm.agent_id"     = var.agent_id
    "fcm.agent_type"   = var.agent_type
    "fcm.capabilities" = var.capabilities
    "fcm.geohash"      = var.geohash
    "managed-by"       = "terraform"
    "project"          = "fcm-blocks-ai"
  }

  agent_env = {
    FCM_AGENT_TYPE        = var.agent_type
    FCM_AGENT_ID          = var.agent_id
    FCM_STAKE             = tostring(var.stake)
    FCM_CAPABILITIES      = var.capabilities
    FCM_GEOHASH           = var.geohash
    FCM_REGISTRY_CONTRACT = var.registry_contract
    FCM_RPC_URL           = var.rpc_url
    HEALTH_PORT           = "8081"
  }
}

output "labels" {
  value = local.agent_labels
}

output "env" {
  value = local.agent_env
}
