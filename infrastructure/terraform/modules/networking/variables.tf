# Terraform version constraint
terraform {
  required_version = "~> 1.0"
}

# Environment variable
variable "environment" {
  type        = string
  description = "Deployment environment name (e.g., staging, production)"

  validation {
    condition     = can(regex("^(staging|production)$", var.environment))
    error_message = "Environment must be either 'staging' or 'production'"
  }
}

# VPC CIDR block
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# Public subnet CIDRs
variable "public_subnet_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks for public subnets, one per AZ"

  validation {
    condition     = length(var.public_subnet_cidrs) > 1
    error_message = "At least two public subnets are required for high availability"
  }
}

# Private subnet CIDRs
variable "private_subnet_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks for private subnets, one per AZ"

  validation {
    condition     = length(var.private_subnet_cidrs) > 1
    error_message = "At least two private subnets are required for high availability"
  }
}

# Availability zones
variable "availability_zones" {
  type        = list(string)
  description = "List of AWS availability zones for subnet deployment"

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones are required for high availability"
  }
}

# NAT Gateway enablement flag
variable "enable_nat_gateway" {
  type        = bool
  description = "Flag to enable NAT Gateway deployment for private subnet internet access"
  default     = true
}

# Resource tags
variable "tags" {
  type        = map(string)
  description = "Common resource tags for networking components"
  default = {
    Terraform = "true"
    Project   = "iwms"
  }
}