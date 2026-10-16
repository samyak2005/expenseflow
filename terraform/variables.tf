variable "project" {
  description = "Name used for tagging and resource names"
  type        = string
  default     = "expenseflow"
}

variable "environment" {
  description = "Environment name, used in tags"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "expenseflow-eks"
}

variable "cluster_version" {
  description = "Kubernetes version (keep it in EKS standard support, extended support costs 6x)"
  type        = string
  default     = "1.35"
}

variable "vpc_cidr" {
  description = "Address range for the VPC"
  type        = string
  default     = "10.30.0.0/16"
}

variable "node_instance_type" {
  description = "EC2 instance type for the worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_desired_size" {
  description = "How many worker nodes to run"
  type        = number
  default     = 3
}
