variable "agent_id" {
  description = "Unique agent identifier"
  type        = string
}

variable "agent_type" {
  description = "Agent workload type (inference, render, edge, etc.)"
  type        = string
}

variable "stake" {
  description = "FCM token stake amount"
  type        = number
  default     = 500
}

variable "capabilities" {
  description = "Comma-separated hardware capabilities"
  type        = string
}

variable "geohash" {
  description = "Geographic location hash"
  type        = string
  default     = "u4pru"
}

variable "fcm_token_contract" {
  description = "FCMToken contract address"
  type        = string
}

variable "registry_contract" {
  description = "FCMAgentRegistry contract address"
  type        = string
}

variable "rpc_url" {
  description = "Blockchain RPC endpoint"
  type        = string
}

variable "private_key_env" {
  description = "Environment variable name for the agent's private key"
  type        = string
  default     = "PRIVATE_KEY"
}
