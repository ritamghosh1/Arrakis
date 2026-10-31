#!/usr/bin/env bash
# E2E persistence check against a running dev server (default http://localhost:3100)
B=${1:-http://localhost:3100}
q() { docker exec arrakis-postgres psql -U arrakis -d arrakis -tA -c "$1"; }
P=post_svg_Minify_canvas

echo "== BEFORE"
q "select 'S_use='||usability_score||' S_pop='||popularity_score||' impressions='||impressions||' multi='||sandbox_multi_runs from posts where id='$P'"
q "select 'ritam vector null? '||(intent_embedding is null)||' xp='||scout_xp from users where id='usr_ritam'"
q "select 'impressions logged: '||count(*) from user_impressions where user_id='usr_ritam'"

echo "== POST /api/telemetry (MULTI + WORKS_GREAT)"
curl -s -X POST "$B/api/telemetry" -H "Content-Type: application/json" -d '{"project_id":"post_svg_Minify_canvas","user_id":"usr_ritam","project_type":"BROWSER","health_ok":true,"boot_time_ms":120,"switched_to_landscape":true,"active_dwell_seconds":60,"interaction_bursts":4,"quick_feedback_tag":"WORKS_GREAT"}'
echo

echo "== AFTER"
q "select 'S_use='||usability_score||' S_pop='||popularity_score||' impressions='||impressions||' multi='||sandbox_multi_runs from posts where id='$P'"
q "select 'ritam vector null? '||(intent_embedding is null)||' xp='||scout_xp from users where id='usr_ritam'"
q "select 'impressions logged: '||count(*) from user_impressions where user_id='usr_ritam'"

echo "== /api/feed (should no longer contain $P first)"
curl -s "$B/api/feed?userId=usr_ritam&limit=5" | grep -o '"id":"post_[^"]*"' | head -5 | tr '\n' ' '
echo
echo "== /api/leaderboard?type=useful (top 3 scores)"
curl -s "$B/api/leaderboard?type=useful" | grep -o '"score":[0-9.]*' | head -3 | tr '\n' ' '
echo
