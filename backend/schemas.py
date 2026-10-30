from pydantic import BaseModel, Field
from typing import List, Optional


class GuestRegister(BaseModel):
    pseudo: str

class EmailRegister(BaseModel):
    pseudo: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class SocialAuthRequest(BaseModel):
    provider: str  # 'google' | 'apple'
    token: str     # id_token for Google, identityToken for Apple
    email: Optional[str] = None   # Apple only sends email on first login
    full_name: Optional[str] = None  # Apple only
    pseudo: Optional[str] = None  # override auto-generated pseudo

class UserResponse(BaseModel):
    id: str
    pseudo: str
    email: Optional[str] = None
    is_guest: bool
    avatar_seed: str
    avatar_url: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    continent: Optional[str] = None
    total_xp: int = 0
    matches_played: int = 0
    matches_won: int = 0
    best_streak: int = 0
    current_streak: int = 0
    mmr: float = 1000.0
    onboarding_done: bool = False
    privacy_accepted: bool = False
    minor: bool = False  # under 15 → non-personalised ads only
    token: Optional[str] = None

class SelectTitleRequest(BaseModel):
    user_id: str
    title: str

class BulkImportRequest(BaseModel):
    category: str
    questions: list

class AdminVerify(BaseModel):
    password: str

class WallPostCreate(BaseModel):
    user_id: str
    content: str
    image_base64: Optional[str] = None

class CommentCreate(BaseModel):
    user_id: str
    content: str = Field(max_length=500)

class FollowToggle(BaseModel):
    user_id: str

class PlayerFollowToggle(BaseModel):
    follower_id: str

class ChatSend(BaseModel):
    sender_id: str
    receiver_id: str
    content: str
    message_type: str = "text"
    extra_data: Optional[dict] = None

class NotifReadRequest(BaseModel):
    user_id: str

class NotifSettingsUpdate(BaseModel):
    user_id: str
    challenges: Optional[bool] = None
    match_results: Optional[bool] = None
    follows: Optional[bool] = None
    messages: Optional[bool] = None
    likes: Optional[bool] = None
    comments: Optional[bool] = None
    system: Optional[bool] = None

class CSVUploadRequest(BaseModel):
    password: str
    questions: List[dict]

class QuestionReportRequest(BaseModel):
    user_id: str = Field(max_length=64)
    question_id: str = Field(max_length=64)
    question_text: Optional[str] = Field(default=None, max_length=500)
    category: Optional[str] = Field(default=None, max_length=100)
    reason_type: str = Field(max_length=32)
    description: Optional[str] = Field(default=None, max_length=1000)

class DeleteThemesRequest(BaseModel):
    password: str
    theme_ids: list[str]
    delete_questions: bool = True
