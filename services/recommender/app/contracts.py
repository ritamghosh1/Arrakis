"""
Frozen v0 Pydantic Contracts for services/recommender (FastAPI)
Mirrors packages/contracts/src/types.ts 1:1
"""
from __future__ import annotations
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel


DemoMode = Literal["api", "web", "container", "handoff"]
ReasonKind = Literal["followed", "taste", "coldstart", "trending", "search"]
EventType = Literal["view", "try", "review", "upvote", "share", "follow"]


class UserRef(BaseModel):
    id: str
    handle: str
    displayName: str
    avatarUrl: str
    verifiedUtility: Optional[bool] = False


class FormFieldSchema(BaseModel):
    name: str
    label: str
    type: Literal["text", "number", "url", "json", "select", "boolean"]
    required: bool = True
    placeholder: Optional[str] = None
    defaultValue: Optional[object] = None
    options: Optional[List[str]] = None


class DemoConfig(BaseModel):
    mode: DemoMode
    target: str
    repoUrl: Optional[str] = None
    formSchema: Optional[List[FormFieldSchema]] = None
    sampleCommand: Optional[str] = None


class PostHealthTelemetry(BaseModel):
    uptimePct: float
    p50LatencyMs: int
    p95LatencyMs: int
    crashRate: float
    verifiedUtility: bool


class PostStats(BaseModel):
    views: int
    tries: int
    upvotes: int
    trialUpvotes: int
    comments: int


class Post(BaseModel):
    id: str
    authorId: str
    author: UserRef
    title: str
    problemStatement: str
    category: str
    videoUrl: str
    thumbUrl: str
    durationSec: int
    demo: DemoConfig
    tags: List[str]
    indexingStatus: Literal["pending", "ready", "failed"] = "ready"
    stats: PostStats
    health: PostHealthTelemetry
    postScore: float
    createdAt: str


class Reason(BaseModel):
    kind: ReasonKind
    via: Optional[UserRef] = None
    matchedTopic: Optional[str] = None
    similarity: Optional[float] = None
    text: str


class ViewerState(BaseModel):
    upvoted: bool = False
    tried: bool = False
    saved: bool = False
    followingAuthor: bool = False


class FeedItem(BaseModel):
    post: Post
    reason: Reason
    viewerState: Optional[ViewerState] = None


class FeedResponse(BaseModel):
    items: List[FeedItem]
    nextCursor: Optional[str] = None
    mode: Literal["for_you", "following", "global"]


class TelemetryEvent(BaseModel):
    id: Optional[str] = None
    userId: str
    postId: Optional[str] = None
    targetUserId: Optional[str] = None
    type: EventType
    value: Optional[float] = 1.0
    ts: str


class EventBatchRequest(BaseModel):
    events: List[TelemetryEvent]
