variable "deployment_name" {
  description = "Name prefix for all FCM infrastructure"
  type        = string
  default     = "fcm-blocks-ai"
}

variable "fcm_token_contract" {
  description = "Address of the FCMToken contract on-chain"
  type        = string
}

variable "registry_contract" {
  description = "Address of the FCMAgentRegistry contract on-chain"
  type        = string
}

variable "rpc_url" {
  description = "Blockchain RPC endpoint"
  type        = string
  default     = "https://mainnet.base.org"
}

# --- Cloud provider credentials (set via terraform.tfvars or env vars) ---

variable "aws_region" {
  description = "AWS region for GPU cluster"
  type        = string
  default     = "us-west-2"
}

variable "aws_access_key" {
  description = "AWS access key ID"
  type        = string
  sensitive   = true
}

variable "aws_secret_key" {
  description = "AWS secret access key"
  type        = string
  sensitive   = true
}

variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "azure_subscription_id" {
  description = "Azure subscription ID"
  type        = string
  sensitive   = true
}

variable "azure_client_id" {
  description = "Azure service principal client ID"
  type        = string
  sensitive   = true
}

variable "azure_client_secret" {
  description = "Azure service principal client secret"
  type        = string
  sensitive   = true
}

variable "azure_tenant_id" {
  description = "Azure tenant ID"
  type        = string
  sensitive   = true
}
