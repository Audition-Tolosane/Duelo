from pydantic import BaseModel
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

class UserResponse(BaseModel):
    id: str
    pseudo: str
    email: Optional[str] = None
    is_guest: bool
    avatar_seed: str
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
    content: str

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
    user_id: str
    question_id: str
    question_text: Optional[str] = None
    category: Optional[str] = None
    reason_type: str
    description: Optional[str] = None

class DeleteThemesRequest(BaseModel):
    password: str
    theme_ids: list[str]
    delete_questions: bool = True
