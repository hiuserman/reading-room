package shelf

// 本棚情報
type Shelf struct {
	ShelfID   string `json:"shelfId" dynamodbav:"shelfId"`
	Name      string `json:"name" dynamodbav:"name"`
	CreatedBy string `json:"createdBy" dynamodbav:"createdBy"`
	CreatedAt string `json:"createdAt" dynamodbav:"createdAt"`
}

// 誰がどの本棚に参加しているか
type Membership struct {
	ShelfID  string `json:"shelfId" dynamodbav:"shelfId"`
	UserID   string `json:"userId" dynamodbav:"userId"`
	Role     string `json:"role" dynamodbav:"role"`
	Status   string `json:"status" dynamodbav:"status"`
	JoinedAt string `json:"joinedAt" dynamodbav:"joinedAt"`
}

// 画面に表示するメンバー情報
type MemberResponse struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName"`
}

// 本棚作成・詳細取得のレスポンス
type ShelfDetailResponse struct {
	ShelfID string           `json:"shelfId"`
	Name    string           `json:"name"`
	Members []MemberResponse `json:"members"`
}
