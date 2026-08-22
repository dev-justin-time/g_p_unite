terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
    hcloud = { source = "hetznercloud/hcloud", version = "~> 1.45" }
  }
  backend "s3" {
    bucket = "fcm-terraform-state"
    key    = "blocks-ai-deployment/terraform.tfstate"
    region = "us-west-2"
    encrypt = true
  }
}

variable "deployment_name" { default = "fcm-blocks-ai" }
variable "fcm_token_contract" {}
variable "registry_contract" {}
variable "rpc_url" {}

module "aws_gpu_cluster" {
  source = "./modules/aws-gpu"
  cluster_name = "${var.deployment_name}-gpu"
  instance_type = "p4d.24xlarge"
  spot_enabled = true
  max_price = "8.00"
  agent_configs = {
    inference-router = { agent_type = "inference", stake = 500, capabilities = "gpu,cuda,avx512" }
    render-splitter = { agent_type = "render", stake = 500, capabilities = "gpu,vulkan,tee" }
    zk-prover = { agent_type = "zk_prover", stake = 750, capabilities = "gpu,cuda,npu" }
  }
  fcm_token_contract = var.fcm_token_contract
  registry_contract = var.registry_contract
  rpc_url = var.rpc_url
}

module "hetzner_cpu_cluster" {
  source = "./modules/hetzner-cpu"
  cluster_name = "${var.deployment_name}-cpu"
  server_type = "cpx51"
  location = "ash"
  agent_configs = {
    edge-runner = { agent_type = "edge", stake = 500, capabilities = "wasm,neon,avx2" }
    game-host = { agent_type = "game", stake = 500, capabilities = "gpu,metal,avx2" }
    science-grid = { agent_type = "science", stake = 500, capabilities = "avx512,mpi,openmp" }
  }
  fcm_token_contract = var.fcm_token_contract
  registry_contract = var.registry_contract
  rpc_url = var.rpc_url
}

module "azure_tee_nodes" {
  source = "./modules/azure-tee"
  cluster_name = "${var.deployment_name}-tee"
  vm_size = "Standard_DC8s_v3"
  agent_configs = {
    fl-coordinator = { agent_type = "federated_learning", stake = 1000, capabilities = "tee,sgx,avx512" }
    privacy-mesh = { agent_type = "privacy", stake = 1000, capabilities = "tee,sgx,neon" }
  }
  fcm_token_contract = var.fcm_token_contract
  registry_contract = var.registry_contract
  rpc_url = var.rpc_url
}

output "gpu_cluster_endpoints" { value = module.aws_gpu_cluster.endpoints }
output "cpu_cluster_endpoints" { value = module.hetzner_cpu_cluster.endpoints }
output "tee_cluster_endpoints" { value = module.azure_tee_nodes.endpoints }
