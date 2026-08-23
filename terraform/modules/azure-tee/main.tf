/**
 * Azure TEE (Trusted Execution Environment) Module
 *
 * Deploys Azure Confidential VMs with SGX enclaves for privacy-sensitive
 * agents (FL Coordinator, Privacy Mesh).
 *
 * Resources:
 *   - Resource Group
 *   - Virtual Network
 *   - Confidential VM (DC-series with SGX)
 *   - Network Security Group
 */

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.0" }
  }
}

# ── Variables ─────────────────────────────────────────────────────

variable "cluster_name" {
  description = "Name of the TEE cluster"
  type        = string
}

variable "vm_size" {
  description = "Azure VM size (must support SGX, e.g., Standard_DC8s_v3)"
  type        = string
  default     = "Standard_DC8s_v3"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
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

variable "admin_username" {
  description = "VM admin username"
  type        = string
  default     = "fcmadmin"
}

# ── Resource Group ────────────────────────────────────────────────

resource "azurerm_resource_group" "fcm" {
  name     = "${var.cluster_name}-rg"
  location = var.location

  tags = {
    project = "fcm-blocks-ai"
  }
}

# ── Networking ────────────────────────────────────────────────────

resource "azurerm_virtual_network" "fcm" {
  name                = "${var.cluster_name}-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.fcm.location
  resource_group_name = azurerm_resource_group.fcm.name

  tags = {
    project = "fcm-blocks-ai"
  }
}

resource "azurerm_subnet" "fcm" {
  name                 = "${var.cluster_name}-subnet"
  resource_group_name  = azurerm_resource_group.fcm.name
  virtual_network_name = azurerm_virtual_network.fcm.name
  address_prefixes     = ["10.0.1.0/24"]
}

# ── Network Security Group ────────────────────────────────────────

resource "azurerm_network_security_group" "fcm" {
  name                = "${var.cluster_name}-nsg"
  location            = azurerm_resource_group.fcm.location
  resource_group_name = azurerm_resource_group.fcm.name

  security_rule {
    name                       = "SSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HealthCheck"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_ranges    = ["8081-8090"]
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = {
    project = "fcm-blocks-ai"
  }
}

# ── Confidential VMs ──────────────────────────────────────────────

resource "azurerm_network_interface" "agents" {
  for_each            = var.agent_configs
  name                = "${var.cluster_name}-${each.key}-nic"
  location            = azurerm_resource_group.fcm.location
  resource_group_name = azurerm_resource_group.fcm.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.fcm.id
    private_ip_address_allocation = "Dynamic"
  }

  tags = {
    agent_id  = each.key
    project   = "fcm-blocks-ai"
  }
}

resource "azurerm_network_interface_security_group_association" "agents" {
  for_each                  = var.agent_configs
  network_interface_id      = azurerm_network_interface.agents[each.key].id
  network_security_group_id = azurerm_network_security_group.fcm.id
}

resource "azurerm_linux_virtual_machine" "agents" {
  for_each            = var.agent_configs
  name                = "${var.cluster_name}-${each.key}"
  resource_group_name = azurerm_resource_group.fcm.name
  location            = azurerm_resource_group.fcm.location
  size                = var.vm_size
  admin_username      = var.admin_username

  # Confidential computing with SGX
  confidential_supported = true

  network_interface_ids = [
    azurerm_network_interface.agents[each.key].id,
  ]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-confidential-vm-jammy"
    sku       = "jammy"
    version   = "latest"
  }

  custom_data = base64encode(templatefile("${path.module}/user-data.sh", {
    agent_id     = each.key
    agent_type   = each.value.agent_type
    capabilities = each.value.capabilities
    stake        = each.value.stake
    registry     = var.registry_contract
    rpc_url      = var.rpc_url
    token        = var.fcm_token_contract
  }))

  tags = {
    agent_id  = each.key
    agent_type = each.value.agent_type
    project   = "fcm-blocks-ai"
  }
}

# ── Outputs ───────────────────────────────────────────────────────

output "endpoints" {
  value = {
    resource_group = azurerm_resource_group.fcm.name
    vnet_id        = azurerm_virtual_network.fcm.id
    nsg_id         = azurerm_network_security_group.fcm.id
    vm_ids         = { for k, v in azurerm_linux_virtual_machine.agents : k => v.id }
    vm_sizes       = { for k, v in azurerm_linux_virtual_machine.agents : k => v.size }
    agent_count    = length(var.agent_configs)
  }
}
