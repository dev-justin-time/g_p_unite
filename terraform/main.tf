/**
 * FCM Expert Agent Swarm — Main Terraform Configuration
 *
 * Orchestrates deployment across 3 cloud providers:
 *   - AWS (GPU agents: inference, render, ZK prover)
 *   - Hetzner (CPU agents: edge, game, science)
 *   - Azure (TEE agents: FL coordinator, privacy mesh)
 *
 * Usage:
 *   terraform init
 *   terraform plan -var-file="terraform.tfvars"
 *   terraform apply -var-file="terraform.tfvars"
 */

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws     = { source = "hashicorp/aws",        version = "~> 5.0" }
    hcloud  = { source = "hetznercloud/hcloud",   version = "~> 1.45" }
    azurerm = { source = "hashicorp/azurerm",      version = "~> 3.0" }
  }
  backend "s3" {
    bucket  = "fcm-terraform-state"
    key     = "blocks-ai-deployment/terraform.tfstate"
    region  = "us-west-2"
    encrypt = true
  }
}

# ── Providers ─────────────────────────────────────────────────────

provider "aws" {
  region = var.aws_region
}

provider "hcloud" {
  token = var.hcloud_token
}

provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
  client_id       = var.azure_client_id
  client_secret   = var.azure_client_secret
  tenant_id       = var.azure_tenant_id
}

# ── AWS GPU Cluster (inference, render, ZK prover) ────────────────

module "aws_gpu_cluster" {
  source = "./modules/aws-gpu"

  cluster_name  = "${var.deployment_name}-gpu"
  instance_type = "p4d.24xlarge"
  spot_enabled  = true
  max_price     = "8.00"
  aws_region    = var.aws_region

  agent_configs = {
    inference-router = {
      agent_type   = "inference"
      stake        = 500
      capabilities = "gpu,cuda,avx512"
    }
    render-splitter = {
      agent_type   = "render"
      stake        = 500
      capabilities = "gpu,vulkan,tee"
    }
    zk-prover = {
      agent_type   = "zk_prover"
      stake        = 750
      capabilities = "gpu,cuda,npu"
    }
  }

  fcm_token_contract = var.fcm_token_contract
  registry_contract  = var.registry_contract
  rpc_url            = var.rpc_url
}

# ── Hetzner CPU Cluster (edge, game, science) ─────────────────────

module "hetzner_cpu_cluster" {
  source = "./modules/hetzner-cpu"

  cluster_name = "${var.deployment_name}-cpu"
  server_type  = "cpx51"
  location     = "ash"

  agent_configs = {
    edge-runner = {
      agent_type   = "edge"
      stake        = 500
      capabilities = "wasm,neon,avx2"
    }
    game-host = {
      agent_type   = "game"
      stake        = 500
      capabilities = "gpu,metal,avx2"
    }
    science-grid = {
      agent_type   = "science"
      stake        = 500
      capabilities = "avx512,mpi,openmp"
    }
  }

  fcm_token_contract = var.fcm_token_contract
  registry_contract  = var.registry_contract
  rpc_url            = var.rpc_url
}

# ── Azure TEE Cluster (FL coordinator, privacy mesh) ──────────────

module "azure_tee_nodes" {
  source = "./modules/azure-tee"

  cluster_name = "${var.deployment_name}-tee"
  vm_size      = "Standard_DC8s_v3"
  location     = "eastus"

  agent_configs = {
    fl-coordinator = {
      agent_type   = "federated_learning"
      stake        = 1000
      capabilities = "tee,sgx,avx512"
    }
    privacy-mesh = {
      agent_type   = "privacy"
      stake        = 1000
      capabilities = "tee,sgx,neon"
    }
  }

  fcm_token_contract = var.fcm_token_contract
  registry_contract  = var.registry_contract
  rpc_url            = var.rpc_url
}

# ── Outputs ───────────────────────────────────────────────────────

output "aws_gpu_cluster" {
  value = module.aws_gpu_cluster.endpoints
}

output "hetzner_cpu_cluster" {
  value = module.hetzner_cpu_cluster.endpoints
}

output "azure_tee_cluster" {
  value = module.azure_tee_nodes.endpoints
}

output "summary" {
  value = {
    total_agents = 8
    providers    = ["aws", "hetzner", "azure"]
    gpu_agents   = ["inference-router", "render-splitter", "zk-prover"]
    cpu_agents   = ["edge-runner", "game-host", "science-grid"]
    tee_agents   = ["fl-coordinator", "privacy-mesh"]
  }
}
