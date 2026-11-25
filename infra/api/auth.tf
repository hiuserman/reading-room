locals {
  frontend_origin = "https://dwryuh9by77z3.cloudfront.net"
}

resource "aws_cognito_user_pool" "readers" {
  name                     = "reading-room-users"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  user_pool_tier           = "LITE"
  deletion_protection      = "ACTIVE"

  username_configuration { case_sensitive = false }
  admin_create_user_config { allow_admin_create_user_only = false }
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }
  verification_message_template { default_email_option = "CONFIRM_WITH_CODE" }
  user_attribute_update_settings { attributes_require_verification_before_update = ["email"] }
}

resource "aws_cognito_user_pool_domain" "readers" {
  domain                = "reading-room-${replace(lower(aws_cognito_user_pool.readers.id), "_", "-")}"
  user_pool_id          = aws_cognito_user_pool.readers.id
  managed_login_version = 1
}

resource "aws_cognito_resource_server" "api" {
  identifier   = "reading-room"
  name         = "Reading Room API"
  user_pool_id = aws_cognito_user_pool.readers.id
  scope {
    scope_name        = "access"
    scope_description = "Access reading APIs as a signed-in user"
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name                                 = "reading-room-web"
  user_pool_id                         = aws_cognito_user_pool.readers.id
  generate_secret                      = false
  supported_identity_providers         = ["COGNITO"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "${aws_cognito_resource_server.api.identifier}/access"]
  callback_urls                        = ["${local.frontend_origin}/", "http://localhost:3000/"]
  logout_urls                          = ["${local.frontend_origin}/", "http://localhost:3000/"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  read_attributes                      = ["email", "email_verified"]
  write_attributes                     = ["email"]
  access_token_validity                = 15
  id_token_validity                    = 15
  refresh_token_validity               = 1
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

# Attach this authorizer AND reading-room/access scope when a Go route is ready.
# The health route intentionally remains public.
resource "aws_apigatewayv2_authorizer" "readers" {
  api_id           = aws_apigatewayv2_api.api.id
  name             = "reading-room-users"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.ap-northeast-1.amazonaws.com/${aws_cognito_user_pool.readers.id}"
  }
}

output "auth_frontend" {
  value = {
    authority = "https://cognito-idp.ap-northeast-1.amazonaws.com/${aws_cognito_user_pool.readers.id}"
    client_id = aws_cognito_user_pool_client.web.id
    domain    = "https://${aws_cognito_user_pool_domain.readers.domain}.auth.ap-northeast-1.amazoncognito.com"
    scope     = "openid email reading-room/access"
  }
}
