package user

type User struct {
	UserID      string `json:"user_id" dynamodbav:"user_id"`
	DisplayName string `json:"display_name" dynamodbav:"display_name"`
	CreatedAt   string `json:"created_at" dynamodbav:"created_at"`
}
