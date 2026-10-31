"""
Arrakis Recommender Service (FastAPI — Dev B: Srinjoy)
Honors MOCK=1 by serving deterministic seed files from infra/seed/*.json.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import math
from typing import Dict, List, Literal, Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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


class TelemetryPayload(BaseModel):
    project_id: str
    user_id: str
    project_type: Literal["BROWSER", "CONTAINER"] = "CONTAINER"
    health_ok: bool = True
    boot_time_ms: int = 0
    switched_to_landscape: bool = False
    active_dwell_seconds: int = 0
    interaction_bursts: int = 0
    quick_feedback_tag: Optional[Literal["WORKS_GREAT", "BUGGY"]] = None


_RUNTIME_USER_VECTORS: Dict[str, List[float]] = {}
_RUNTIME_IMPRESSIONS: Dict[str, set] = {}


def _cosine_sim(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.5
    n = min(len(a), len(b))
    dot = sum(a[i] * b[i] for i in range(n))
    na = math.sqrt(sum(a[i] * a[i] for i in range(n))) or 1.0
    nb = math.sqrt(sum(b[i] * b[i] for i in range(n))) or 1.0
    return dot / (na * nb)


def _classify_run_tier(p: TelemetryPayload) -> str:
    if p.active_dwell_seconds < 5 or p.interaction_bursts == 0:
        return "BOUNCE"
    if p.active_dwell_seconds >= 45 and (p.interaction_bursts >= 3 or p.switched_to_landscape):
        return "MULTI"
    if p.active_dwell_seconds >= 15 and p.interaction_bursts >= 1:
        return "SINGLE"
    return "BOUNCE"


@app.post("/telemetry")
def ingest_telemetry(payload: TelemetryPayload):
    run_tier = _classify_run_tier(payload)
    tag_delta = 2.0 if payload.quick_feedback_tag == "WORKS_GREAT" else (-3.0 if payload.quick_feedback_tag == "BUGGY" else 0.0)

    seen = _RUNTIME_IMPRESSIONS.setdefault(payload.user_id, set())
    seen.add(payload.project_id)

    if run_tier in ("SINGLE", "MULTI") and payload.quick_feedback_tag != "BUGGY":
        user_vectors = _load_seed("user_vectors.json") or {}
        post_vectors = _load_seed("post_vectors.json") or {}
        u_vec = _RUNTIME_USER_VECTORS.get(payload.user_id) or user_vectors.get(payload.user_id)
        p_vec = post_vectors.get(payload.project_id)
        if p_vec:
            if not u_vec:
                _RUNTIME_USER_VECTORS[payload.user_id] = list(p_vec)
            else:
                alpha = 0.30 if run_tier == "MULTI" else 0.15
                _RUNTIME_USER_VECTORS[payload.user_id] = [
                    round((1.0 - alpha) * u_vec[i] + alpha * p_vec[i], 4)
                    for i in range(min(len(u_vec), len(p_vec)))
                ]

    return {
        "ok": True,
        "run_tier": run_tier,
        "tag_delta": tag_delta,
        "user_vector": _RUNTIME_USER_VECTORS.get(payload.user_id),
    }


@app.get("/feed/debug")
def debug_feed(userId: str = Query(default="usr_ritam")):
    user_vectors = _load_seed("user_vectors.json") or {}
    return {
        "userId": userId,
        "tasteVector": _RUNTIME_USER_VECTORS.get(userId) or user_vectors.get(userId, []),
        "impressionsCount": len(_RUNTIME_IMPRESSIONS.get(userId, set())),
        "weights": {"view": 0.2, "try": 0.6, "review": 1.0, "share": 0.4},
        "hybridFormula": "0.50*intent + 0.25*usability + 0.15*popularity_decayed + 0.10*coldstart",
        "coldStartQuota": "20% (2 per 10 items)",
    }
