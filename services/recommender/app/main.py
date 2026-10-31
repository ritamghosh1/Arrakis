"""
Arrakis Recommender Service (FastAPI — Dev B: Srinjoy)
Honors MOCK=1 by serving deterministic seed files from infra/seed/*.json.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from .contracts import EventBatchRequest, FeedResponse

SEED_DIR = Path(__file__).resolve().parents[3] / "infra" / "seed"

app = FastAPI(
    title="Arrakis Recommender Service",
    version="0.1.0",
    description="80/20 Dynamic Taste Vector, Follow Graph Attribution & Hybrid Problem Search",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_seed(filename: str):
    path = SEED_DIR / filename
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/healthz")
def healthz():
    return {
        "status": "ok",
        "service": "recommender",
        "mock": os.getenv("MOCK", "1") == "1",
    }


@app.get("/feed/home", response_model=FeedResponse)
def get_home_feed(
    userId: str = Query(default="usr_ritam"),
    mode: str = Query(default="for_you"),
    cursor: Optional[str] = Query(default=None),
):
    seed_feed = _load_seed("sample_home_feed_ritam.json")
    if seed_feed:
        return seed_feed
    return {"items": [], "nextCursor": None, "mode": "for_you"}


@app.get("/feed/global", response_model=FeedResponse)
def get_global_feed(
    q: Optional[str] = Query(default=None),
    mode: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
):
    posts = _load_seed("posts.json") or []
    q_norm = (q or "").strip().lower()
    items = []
    for idx, p in enumerate(posts):
        if mode and p.get("demo", {}).get("mode") != mode:
            continue
        if category and p.get("category", "").lower() != category.lower():
            continue
        if q_norm:
            haystack = f"{p.get('title', '')} {p.get('problemStatement', '')} {' '.join(p.get('tags', []))}".lower()
            if q_norm not in haystack:
                continue
        reason = (
            {
                "kind": "search",
                "matchedTopic": q_norm,
                "similarity": round(max(0.70, 0.95 - idx * 0.03), 2),
                "text": f'Solves "{q_norm}" · {int(max(70, 95 - idx * 3))}% problem match',
            }
            if q_norm
            else {
                "kind": "trending",
                "text": f"{p['health']['uptimePct']}% live demo uptime · {p['stats']['tries']} instant trials",
            }
        )
        items.append({"post": p, "reason": reason})
    return {"items": items[:20], "nextCursor": None, "mode": "global"}


@app.post("/follow/{user_id}")
def follow_user(user_id: str, followerId: str = Query(default="usr_ritam")):
    return {"ok": True, "followerId": followerId, "followeeId": user_id, "following": True}


@app.delete("/follow/{user_id}")
def unfollow_user(user_id: str, followerId: str = Query(default="usr_ritam")):
    return {"ok": True, "followerId": followerId, "followeeId": user_id, "following": False}


@app.get("/suggestions/users")
def suggest_users(userId: str = Query(default="usr_ritam")):
    users = _load_seed("users.json") or []
    return {"users": [u for u in users if u.get("id") != userId][:8]}


@app.post("/events", status_code=202)
def ingest_events(batch: EventBatchRequest):
    return {"accepted": len(batch.events)}


@app.get("/feed/debug")
def debug_feed(userId: str = Query(default="usr_ritam")):
    user_vectors = _load_seed("user_vectors.json") or {}
    return {
        "userId": userId,
        "tasteVector": user_vectors.get(userId, []),
        "weights": {"view": 0.2, "try": 0.6, "review": 1.0, "share": 0.4},
        "coldStartQuota": "20% (2 per 10 items)",
    }
