resource "aws_apigatewayv2_route" "create_shelf" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /api/shelves"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"

  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.readers.id
  authorization_scopes = ["reading-room/access"]
}

resource "aws_lambda_permission" "create_shelf" {
  statement_id  = "AllowCreateShelfFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.api.execution_arn}/*/POST/api/shelves"
}