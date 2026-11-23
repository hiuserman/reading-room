resource "aws_apigatewayv2_route" "me" {
  for_each = toset(["GET", "POST"])

  api_id    = aws_apigatewayv2_api.api.id
  route_key = "${each.value} /api/me"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"

  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.readers.id
  authorization_scopes = ["reading-room/access"]
}

resource "aws_lambda_permission" "me" {
  for_each = toset(["GET", "POST"])

  statement_id  = "AllowMe${each.value}FromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.api.execution_arn}/*/${each.value}/api/me"
}