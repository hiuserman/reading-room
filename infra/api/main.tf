terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"
}

locals {
  function_name = "reading-room-health"
}

# bootstrapをZIP直下に入れ、実行権限を付ける
data "archive_file" "backend" {
  type             = "zip"
  source_file      = "${path.module}/../../App/dist/bootstrap"
  output_path      = "${path.module}/../../App/dist/backend.zip"
  output_file_mode = "0755"
}

resource "aws_iam_role" "lambda" {
  name = "${local.function_name}-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 7
}
resource "aws_apigatewayv2_api" "api" {
  name          = local.function_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [
      "https://dwryuh9by77z3.cloudfront.net",
      "http://localhost:3000"
    ]
    allow_methods = ["GET", "POST"]
    allow_headers = ["Authorization", "Content-Type"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /api/health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 10
    throttling_rate_limit  = 5
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowHealthFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.api.execution_arn}/*/GET/api/health"
}

output "health_url" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/api/health"
}

resource "aws_lambda_function" "api" {
  function_name = local.function_name
  role          = aws_iam_role.lambda.arn

  runtime       = "provided.al2023"
  handler       = "bootstrap"
  architectures = ["x86_64"]

  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256

  memory_size = 256
  timeout     = 10

  layers = [
    "arn:aws:lambda:ap-northeast-1:753240598075:layer:LambdaAdapterLayerX86:30"
  ]

  environment {
    variables = {
      GIN_MODE                               = "release"
      AWS_LWA_PORT                           = "8080"
      AWS_LWA_READINESS_CHECK_PATH           = "/api/health"
      AWS_LWA_READINESS_CHECK_HEALTHY_STATUS = "200"
      USERS_TABLE_NAME                       = aws_dynamodb_table.users.name
      SHELVES_TABLE_NAME                     = aws_dynamodb_table.shelves.name
      MEMBERS_TABLE_NAME                     = aws_dynamodb_table.shelf_members.name
      COGNITO_ISSUER                         = "https://cognito-idp.ap-northeast-1.amazonaws.com/${aws_cognito_user_pool.readers.id}"
      COGNITO_CLIENT_ID                      = aws_cognito_user_pool_client.web.id
      COGNITO_REQUIRED_SCOPE                 = "reading-room/access"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_logs,
    aws_cloudwatch_log_group.lambda
  ]
}
