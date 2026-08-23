variable "cluster_name" {
  description = "Name of the GPU cluster"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type (e.g., p4d.24xlarge)"
  type        = string
  default     = "p4d.24xlarge"
}

variable "spot_enabled" {
  description = "Use spot instances for cost savings"
  type        = bool
  default     = true
}

variable "max_price" {
  description = "Maximum spot price per hour"
  type        = string
  default     = "8.00"
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 4
}

variable "agent_configs" {
  description = "Map of agent configurations to deploy"
  type = map(object({
    agent_type   = string
    stake        = number
    capabilities = string
  }))
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

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "Subnet CIDR block"
  type        = string
  default     = "10.0.1.0/24"
}
