# VPC Outputs
output "vpc_id" {
  description = "ID of the created VPC for IWMS application deployment"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the created VPC for network planning"
  value       = aws_vpc.main.cidr_block
}

# Subnet Outputs
output "public_subnet_ids" {
  description = "List of IDs of public subnets distributed across availability zones for high availability"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of IDs of private subnets distributed across availability zones for secure resource deployment"
  value       = aws_subnet.private[*].id
}

output "public_subnet_cidrs" {
  description = "List of CIDR blocks of public subnets for network planning and security group configuration"
  value       = aws_subnet.public[*].cidr_block
}

output "private_subnet_cidrs" {
  description = "List of CIDR blocks of private subnets for network planning and security group configuration"
  value       = aws_subnet.private[*].cidr_block
}

# Routing Outputs
output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs for private subnet internet access, conditionally created based on enable_nat_gateway variable"
  value       = try(var.enable_nat_gateway ? aws_nat_gateway.main[*].id : [], [])
}

output "public_route_table_id" {
  description = "ID of the public route table for internet-facing resources"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "List of IDs of private route tables for internal resource routing"
  value       = aws_route_table.private[*].id
}

# Availability Zone Outputs
output "availability_zones" {
  description = "List of availability zones where networking components are deployed"
  value       = var.availability_zones
}

# Network Flow Logs Output
output "flow_logs_enabled" {
  description = "Indicates whether VPC Flow Logs are enabled for network traffic monitoring"
  value       = var.enable_vpc_flow_logs
}

output "flow_logs_log_group_name" {
  description = "Name of the CloudWatch Log Group for VPC Flow Logs if enabled"
  value       = try(var.enable_vpc_flow_logs ? aws_cloudwatch_log_group.flow_logs[0].name : null, null)
}