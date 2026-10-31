# Transcript
> Text extracted from the uploaded AKI HACKS presentation PDF. Layout and visual elements are not reproduced.

## Page 1

Team Name : UNEMPLOYEDS
Team Leader Name : SRINJOY MUKHERJEE

Problem Statement : Moving indie projects out of
static code repositories and into the hands of
everyday users through frictionless, utility-first
discovery.

## Page 2

PROPOSED SOLUTION
    The Discovery Gap:
                                                 Arrakis : Utility-First Social Feed                Mutual Growth Engine
Problem statement in detail

  Builder's Bottleneck: Great prototypes die
  in private repos with zero user feedback or
                                                                                                                 For BUILDERS :
  scalability testing.                                                                            Real early adopters • Live traffic & system-design scale
                                                                                                          testing • Feature ideas from comments.


  User's Barrier: Today, non-technical users
  cannot easily find, run, or test early-stage
  projects without navigating complex
  codebases or setup steps.
                                                                <2 min Demo reels
                                                                                                                        For USERS :
  Platform Mismatch:
      LinkedIn / GitHub: Built for developer
                                                         🎬 2-Min Product Reels & Posts (Show
                                                         what it does, not code)                     Discover useful tools effortlessly • Search by
      peers, zero requirement-based search.                                                     requirement/problem • Shape tools they actually need.

     Instagram / Reels: Too chaotic; no
                                                         🌐 Smart Discovery (Scrollable Feed +
                                                         Global Problem Search)
     native way to test software utility.

     Product Hunt: Built for polished SaaS               💬 Direct Feedback Loop (Comments
                                                         drive feature updates)
     with existing audiences, not student
     MVPs.
                                                                                                     Products go viral for their utility, not
                                                                                                              their framework.

## Page 3

SYSTEM & USER WORKFLOW
👤 User Flow (3-Tap Discovery)                                                 💻 Developer Flow (Zero-Code Onboarding)
           1. Scroll Utility Feed   🎬                                                           1. Record Product Pitch

                                                                                             Upload a raw 2-min utility demo
    Swipe through 60s–2min vertical reels
  focused purely on what the project solves.


                                                                                               2. Keep Existing Hosting

                                                                                 Bring your live URL/API (Vercel, Render, Hugging Face,
                                                                                                       Railway).                                   In-App WebView
           2. 1-Tap Instant Try     ⚡
    Launch an interactive micro-demo overlay
     instantly—zero downloads or redirects.
                                                                                       3. Pick a Zero-Code Demo Wrapper                         API/CLI Form Builder




                                                                                                4. AI Vector Auto-Indexing
                                                                                                                                                 Send-to-Laptop Link
            3. Validate & Earn   🏆                                              Engine transcribes video & indexes the problem statement for
                                                                                                     requirement search.
      Submit structured feedback to earn
  Discoverer Badges and developer bounties.
                                               Real-Time Feedback & Traffic
                                                                                              5. Live Telemetry & Feedback

                                                                                 Track test runs, conversions, and scalability bottlenecks on
                                                                                                       the dashboard.

## Page 4

TECHNICAL APPROACH
     🎬 1. PWA & Adaptive Media Pipeline                                                     ⚡ 3. Zero-Code Micro-Demo Sandbox
  Next.js 14 PWA:                                                                      Mode A (API/CLI Proxy):
  CSS Scroll-Snap + IntersectionObserver (preloads                                     Auto-Form ➔ Edge Proxy (10s timeout + Upstash Redis
  next reel, frees off-screen RAM).                                                    rate limit) ➔ live SSE terminal stream.


  Instant <300ms Stream:
  Raw .mp4 (<60s) ➔ Cloudflare Stream / Mux ➔
                                                       ⚖️ Anti-Clout Ranking Formula   Mode B (Web Apps):
                                                                                       Isolated bottom-sheet <iframe sandbox> (XSS & frame-
                                                                                       busting safe).
  Adaptive HLS (.m3u8).
                                                                                       Mode C (Desktop Handoff):
                                                                                       1-tap "Send to Laptop" link via Resend / WebPush.




🧠 2. AI Requirement Indexing & 80/20 Feed                        Variables                📊 4. Automated Telemetry & Reward Loop
Zero-Buzzword Indexing:                                                                Auto Scalability Health Card:
Video Audio ➔ Whisper API ➔ LLM Utility Extractor ➔                                    Edge Proxy automatically logs Latency, HTTP Status, &
pgvector (text-embedding-3-small)                                                      Crash Rates + 3-Tap Micro-Review (Worked? Use it? 1-line
                                                                                       bug).
Hybrid Search:                                                                         Tester Rewards:
BM25 + Cosine Similarity matches natural problem                                        First-25 Scout XP, Auto Beta Keys, AI Compute Credits
queries to tools.                                                                      Builder Perks:
80/20 Feed:                                                                            GitHub "Verified Utility" Badge (>85% uptime) + 1-Click
                                                                                       Co-Founder Tag.
Dynamic Taste Vector (Watch +0.2 | Try Demo +0.6 |
Feedback +1.0) + 20% Cold-Start boost for 0-follower
builders

## Page 5

INNOVATION & DIFFERENTIATION
                       3 First-of-Their-Kind Innovations

                             ⚡ 1. Zero-Code In-Feed Sandbox
                        Unlike Reels or LinkedIn, users test live APIs, CLIs, and Web Apps
                        inside the video feed in 1 tap—zero installs or mobile UI code
                        required.




                             🧠 2. Problem-First Vector Search
                        We don't index hashtags or tech buzzwords. Whisper + LLM
                        extracts what problem the tool solves, letting users search by
                        real-world utility.




                             ⚖️ 3. Proof-of-Trial Ranking (Anti-Clout)
                        Upvotes from users who actually ran the micro-demo count
                        3X more than passive viewers—killing ProductHunt
                        popularity contests.

## Page 6

FEASIBILITY, IMPACT & FUTURE

🛠️ 1. FEASIBILITY (Why It Works Today)                  🌍 2. IMPACT (The Ecosystem Shift)                        🚀 3. FUTURE ROADMAP (Next 6–12
                                                                                                                                    Months)
Zero Compute Hosting Cost: Builders keep their          For Everyday Users: Democratizes access to             Phase 1 — GitHub CI/CD Auto-Sync: Push a
own backend hosting (Vercel, Render, Railway).          bleeding-edge AI & indie tools through zero-install,   release tag to GitHub ➔ automatically updates the
Arrakis only acts as a lightweight Edge Proxy &         1-tap testing and problem-based search                 Arrakis Micro-Demo endpoint & triggers a "What's
Discovery Layer.                                                                                               New" reel to testers.


Near-Zero Indexing Cost: Transcribing a 60s audio       For Indie & Student Builders: Turns "dead GitHub       Phase 2 — Ephemeral Cloud Sandboxes: Spin up
clip via Whisper + text-embedding-3-small costs         repos" into live products with real traffic, load      instant WebContainers / Docker micro-VMs in the
<$0.004 per uploaded project.                           telemetry, and early adopters—regardless of            browser for repos that don't even have a live
                                                        follower count (20% Cold-Start guarantee).             hosted link yet.

 Zero Compute Hosting Cost: Builders keep their
 own backend hosting (Vercel, Render, Railway).         For Hackathons & Recruiters: Replaces static           Phase 3 — Micro-Monetization & B2B Hiring: Let
 Arrakis only acts as a lightweight Edge Proxy &        resume bullet points with Verified Utility Badges      users tip/subscribe to indie tools in 1 click, and let
 Discovery Layer.                                       (>85% live demo success) and real user retention       startups recruit top builders ranked by Proof-of-
                                                        proof                                                  Trial Score.
