/**
 * Hetzner CPU Cluster Module
 *
 * Deploys cloud servers on Hetzner for CPU-bound agents (edge, game, science).
 * Cost-effective alternative to AWS for non-GPU workloads.
 *
 * Resources:
 *   - Cloud Network
 *   - Cloud Servers
 *   - SSH Keys
 */

terraform {
  required_providers {
    hcloud = { source = "hetznercloud/hcloud", version = "~> 1.45" }
  }
}

# ── Variables ─────────────────────────────────────────────────────

variable "cluster_name" {
  description = "Name of the CPU cluster"
  type        = string
}

variable "server_type" {
  description = "Hetzner server type (e.g., cpx51)"
  type        = string
  default     = "cpx51"
}

variable "location" {
  description = "Hetzner datacenter location"
  type        = string
  default     = "ash"
}

variable "image" {
  description = "Server image"
  type        = string
  default     = "ubuntu-22.04"
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

# ── Network ───────────────────────────────────────────────────────

resource "hcloud_network" "fcm" {
  name     = "${var.cluster_name}-net"
  ip_range = "10.0.0.0/16"

  labels = {
    project = "fcm-blocks-ai"
  }
}

resource "hcloud_network_subnet" "fcm" {
  network_id = hcloud_network.fcm.id
  type       = "cloud"
  network_zone = "us-east"
  ip_range   = "10.0.1.0/24"
}

# ── Firewall ──────────────────────────────────────────────────────

resource "hcloud_firewall" "fcm" {
  name = "${var.cluster_name}-fw"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "8081-8090"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "udp"
    port       = "7777"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  labels = {
    project = "fcm-blocks-ai"
  }
}

# ── Servers ───────────────────────────────────────────────────────

resource "hcloud_server" "agents" {
  for_each = var.agent_configs

  name         = "${var.cluster_name}-${each.key}"
  server_type  = var.server_type
  image        = var.image
  location     = var.location
  firewall_ids = [hcloud_firewall.fcm.id]

  network {
    network_id = hcloud_network.fcm.id
  }

  user_data = templatefile("${path.module}/user-data.sh", {
    agent_id      = each.key
    agent_type    = each.value.agent_type
    capabilities  = each.value.capabilities
    stake         = each.value.stake
    registry      = var.registry_contract
    rpc_url       = var.rpc_url
    token         = var.fcm_token_contract
  })

  labels = {
    agent_id    = each.key
    agent_type  = each.value.agent_type
    project     = "fcm-blocks-ai"
  }
}

# ── Outputs ───────────────────────────────────────────────────────

output "endpoints" {
  value = {
    network_id = hcloud_network.fcm.id
    servers    = { for k, v in hcloud_server.agents : k => v.ipv4_address }
    firewall_id = hcloud_firewall.fcm.id
    agent_count = length(var.agent_configs)
  }
}
