/**
 * AWS GPU Cluster Module
 *
 * Deploys EC2 instances with NVIDIA GPUs for inference, rendering, and ZK proving.
 * Uses spot instances by default for cost optimization.
 *
 * Resources:
 *   - VPC + Subnet (or uses default)
 *   - Security Group (SSH, health checks)
 *   - Launch Template (GPU-optimized AMI)
 *   - Auto Scaling Group
 *   - IAM Role (SSM access, CloudWatch)
 */

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Data Sources ──────────────────────────────────────────────────

data "aws_ami" "gpu_ami" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["deep-learning-ami-ubuntu-22*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ── Networking ────────────────────────────────────────────────────

resource "aws_vpc" "gpu" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name    = "${var.cluster_name}-vpc"
    Project = "fcm-blocks-ai"
  }
}

resource "aws_subnet" "gpu" {
  vpc_id                  = aws_vpc.gpu.id
  cidr_block              = var.subnet_cidr
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name    = "${var.cluster_name}-subnet"
    Project = "fcm-blocks-ai"
  }
}

resource "aws_internet_gateway" "gpu" {
  vpc_id = aws_vpc.gpu.id

  tags = {
    Name    = "${var.cluster_name}-igw"
    Project = "fcm-blocks-ai"
  }
}

resource "aws_route_table" "gpu" {
  vpc_id = aws_vpc.gpu.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gpu.id
  }

  tags = {
    Name    = "${var.cluster_name}-rt"
    Project = "fcm-blocks-ai"
  }
}

resource "aws_route_table_association" "gpu" {
  subnet_id      = aws_subnet.gpu.id
  route_table_id = aws_route_table.gpu.id
}

# ── Security Group ────────────────────────────────────────────────

resource "aws_security_group" "gpu" {
  name_prefix = "${var.cluster_name}-"
  vpc_id      = aws_vpc.gpu.id

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Health check
  ingress {
    from_port   = 8081
    to_port     = 8090
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Game host UDP
  ingress {
    from_port   = 7777
    to_port     = 7777
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # IPFS
  ingress {
    from_port   = 4001
    to_port     = 5001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.cluster_name}-sg"
    Project = "fcm-blocks-ai"
  }
}

# ── IAM Role ──────────────────────────────────────────────────────

resource "aws_iam_role" "gpu" {
  name = "${var.cluster_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = {
    Project = "fcm-blocks-ai"
  }
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.gpu.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "gpu" {
  name = "${var.cluster_name}-profile"
  role = aws_iam_role.gpu.name
}

# ── Launch Template ───────────────────────────────────────────────

resource "aws_launch_template" "gpu" {
  name_prefix   = "${var.cluster_name}-"
  image_id      = data.aws_ami.gpu_ami.id
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.gpu.name
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.gpu.id]
  }

  user_data = base64encode("#!/bin/bash\necho 'FCM GPU Agent ready'\n")

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.agent_labels, {
      Name = "${var.cluster_name}-gpu"
    })
  }

  tags = {
    Project = "fcm-blocks-ai"
  }
}

# ── Auto Scaling Group ────────────────────────────────────────────

resource "aws_autoscaling_group" "gpu" {
  name                = "${var.cluster_name}-asg"
  min_size            = var.min_instances
  max_size            = var.max_instances
  desired_capacity    = var.min_instances
  vpc_zone_identifier = [aws_subnet.gpu.id]

  launch_template {
    id      = aws_launch_template.gpu.id
    version = "$Latest"
  }

  tag {
    key                 = "Project"
    value               = "fcm-blocks-ai"
    propagate_at_launch = true
  }
}

# ── Outputs ───────────────────────────────────────────────────────

output "endpoints" {
  value = {
    vpc_id      = aws_vpc.gpu.id
    subnet_id   = aws_subnet.gpu.id
    sg_id       = aws_security_group.gpu.id
    asg_name    = aws_autoscaling_group.gpu.name
    region      = var.aws_region
    agent_count = length(var.agent_configs)
  }
}
