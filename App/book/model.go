package book

type Book struct {
	ShelfID   string   `json:"shelfId" dynamodbav:"shelfId"`
	BookID    string   `json:"bookId" dynamodbav:"bookId"`
	Title     string   `json:"title" dynamodbav:"title"`
	Authors   []string `json:"authors" dynamodbav:"authors"`
	CreatedAt string   `json:"createdAt" dynamodbav:"createdAt"`
}
