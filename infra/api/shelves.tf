resource "aws_dynamodb_table" "shelves" {
  name         = "reading-room-shelves"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "shelfId"

  attribute {
    name = "shelfId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "shelf_members" {
  name         = "reading-room-shelf-members"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "shelfId"
  range_key    = "userId"

  attribute {
    name = "shelfId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }
}

resource "aws_iam_role_policy" "shelves_access" {
  name = "reading-room-shelves-access"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem"
      ]
      Resource = [
        aws_dynamodb_table.shelves.arn,
        aws_dynamodb_table.shelf_members.arn
      ]
    }]
  })
}