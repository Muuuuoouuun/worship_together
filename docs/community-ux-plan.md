# Community UX Execution Plan

## Why this plan exists

`Worship Together` is currently optimized for worship preparation and live session control. The existing flow is strong for leaders and worship teams, but it does not yet give church members a clear path to:

- feel spiritually and socially connected,
- ask for help or prayer safely,
- discover ways to serve others,
- return regularly because the product supports belonging, not only coordination.

This plan defines the UX structure to add community immersion and mutual care before implementation starts.

## Current product reality

Current primary flow in the app:

1. `app/page.tsx`: worship-team-focused landing page.
2. `app/dashboard/page.tsx`: upcoming worship plus session actions.
3. `app/session/[id]/page.tsx`: live rehearsal/service control workspace.

Current product strength:

- real-time worship coordination,
- leader/follower session structure,
- clear setlist and live-session mental model.

Current gap:

- no community home,
- no prayer/help workflow,
- no volunteer matching flow,
- no follow-up loop after worship,
- no onboarding path for newcomers or non-team members.

## Product goal

Shift the product from a `worship operation tool` to a `faith community participation platform` without breaking the existing worship workflow.

## North star behavior

A user should be able to complete at least one meaningful faith-community action every visit:

- join worship,
- respond to a prayer/care request,
- commit to serving,
- follow up with a person or group,
- reflect on the message and return for the next step.

## UX principles

### 1. Reverence before engagement

The product should feel pastoral and calm, not like a social feed. Prompts should guide users into participation without turning the experience into noisy gamification.

### 2. Belonging before utility

Users should quickly understand where they belong: worship team, congregation, prayer group, volunteer ministry, or newcomer path.

### 3. Help should be easy to ask for and easy to answer

The product must reduce friction for both sides of care:

- asking for prayer, support, or follow-up,
- seeing concrete ways to respond.

### 4. Every worship moment should lead somewhere

The session itself should not be the end of the experience. After worship, users should naturally move into reflection, care, small group connection, or service.

### 5. Sensitive data needs clear boundaries

Prayer requests, personal needs, and pastoral care items must have visible privacy levels and moderation controls.

## Core user segments

### Newcomer

- Wants a low-pressure way to attend, understand the church, and ask for connection.
- Needs clear next steps and trust signals.

### Member

- Wants to worship, stay informed, receive prayer, and stay connected to people and church life.
- Needs a meaningful home dashboard, not just service operations.

### Volunteer / Ministry servant

- Wants to see where help is needed and commit quickly.
- Needs scheduling clarity, role expectations, and follow-up reminders.

### Leader / Pastor / Worship leader

- Wants oversight over worship, care, and volunteer response.
- Needs moderation tools, visibility, and escalation paths.

## Proposed information architecture

Keep the existing worship routes, but expand the product around a new community center.

### 1. Landing: invitation by intent

Refactor the landing page so users can enter through one of four intentions:

- worship with the church,
- ask for prayer or care,
- find a place to serve,
- join a group or newcomer path.

Landing outcome:

- make the platform relevant beyond choir and worship leaders,
- communicate trust and warmth,
- reduce ambiguity for first-time visitors.

### 2. Dashboard: change from worship dashboard to community home

The dashboard should become `Today in Community`, with blocks ordered by urgency and relevance:

- upcoming worship or live session,
- prayer and care requests,
- serving opportunities,
- small groups / fellowship events,
- personal next step.

Recommended dashboard modules:

1. `Community Pulse`
   - worship today,
   - new prayer requests,
   - open volunteer needs,
   - unread follow-ups.
2. `My Next Step`
   - one primary CTA based on user state.
   - examples: `Join live worship`, `Respond to a prayer request`, `Complete newcomer step 2`, `Confirm serving`.
3. `Prayer & Care`
   - submit request,
   - pray for others,
   - mark follow-up completed.
4. `Serve This Week`
   - open roles,
   - team needs,
   - sign-up status.
5. `Groups & Fellowship`
   - Bible study,
   - small group,
   - testimony night,
   - newcomer gathering.

### 3. New community routes

Add dedicated spaces instead of overloading the worship session UI:

- `/community`: central community activity and follow-up hub.
- `/care`: prayer requests, needs, pastoral care triage.
- `/serve`: volunteer opportunities and ministry sign-ups.
- `/groups`: small groups, classes, newcomer path, fellowship events.

### 4. Session route: add post-worship connection bridge

The live session route should remain worship-focused, but it should end with a soft community bridge:

- reflection prompt,
- prayer response,
- serving invitation,
- follow-up group link.

This keeps the session sacred and uncluttered while still connecting worship to community life.

## Primary engagement loops

### Loop A: worship to belonging

1. User joins worship or watches live.
2. User sees one simple next step after the service.
3. User joins a group, requests prayer, or saves a reflection.
4. User receives a reminder or follow-up before the next gathering.

### Loop B: need to care

1. User submits prayer or help request.
2. Request is tagged by privacy and urgency.
3. Leaders or volunteers are notified.
4. Someone responds.
5. User sees follow-up status and feels cared for.

### Loop C: intention to service

1. User sees a concrete need.
2. User commits to a role in one tap.
3. User receives clear preparation details.
4. After completion, the app confirms impact and suggests the next serving step.

## Recommended screen structure by route

### `app/page.tsx`

Change from brand-first hero to mission-and-path entry:

- headline about worship, care, and serving together,
- four primary entry cards by user intent,
- trust section explaining prayer/privacy/community support,
- testimonies or examples of community impact.

### `app/dashboard/page.tsx`

Replace purely operational emphasis with a layered home:

- top hero: live worship or next community moment,
- middle: prayer/care and serving,
- lower: groups, events, reflection history, announcements.

The existing `NextWorshipCard` can remain, but it should become one module inside a broader dashboard.

### `app/session/[id]/page.tsx` and `components/session/SessionWorkspace.tsx`

Keep live control focused, then add:

- a right-rail or footer card for `Pray with the church`,
- post-session response sheet,
- notes such as `Need prayer?`, `Want to serve next week?`, `Join this group`.

Avoid adding feed-like interactions directly into the live worship control surface.

## Feature priorities before implementation

### Phase 0: planning and research

- define target users more clearly: congregation, ministry volunteers, leaders, newcomers,
- define privacy policy for prayer/care requests,
- define moderation roles and response SLAs,
- define what counts as a successful community action.

### Phase 1: structure and navigation

- redesign landing page entry points,
- redesign dashboard IA,
- add navigation for community/care/serve/groups,
- add role-aware content rules.

### Phase 2: prayer and care MVP

- submit prayer request,
- set visibility: private, leaders only, group, public church,
- allow response actions: pray, follow up, assign care owner,
- add care queue for leaders.

### Phase 3: serving MVP

- list ministry needs,
- allow sign-up and confirmation,
- show serving commitments on dashboard,
- add reminders and completion tracking.

### Phase 4: retention and discipleship loop

- post-worship reflection,
- newcomer guided path,
- recurring group nudges,
- testimony and answered-prayer summaries.

## Data model additions to anticipate

Likely new entities:

- `profiles`
- `groups`
- `events`
- `prayer_requests`
- `care_tasks`
- `care_responses`
- `volunteer_opportunities`
- `volunteer_commitments`
- `reflections`
- `announcements`

Important fields:

- privacy level,
- ministry owner,
- urgency,
- follow-up status,
- assigned responder,
- completion timestamp,
- church/team/group scope.

## Metrics to track

Do not measure only session starts. Track community participation outcomes.

Primary metrics:

- percentage of users completing one community action per week,
- prayer request submission to first response time,
- volunteer opportunity view-to-commit conversion,
- repeat participation across worship plus one other module,
- newcomer first-visit to second-step conversion.

Secondary metrics:

- dashboard module CTR,
- post-worship response completion rate,
- number of unresolved care items,
- group join rate after worship attendance.

## Risks and guardrails

### Risk: it becomes a generic community app

Guardrail:

- keep worship and care language spiritually grounded,
- preserve reverence in visual tone and writing,
- avoid addictive feed mechanics.

### Risk: private needs are exposed too broadly

Guardrail:

- explicit privacy controls,
- role-based visibility,
- audit trail for care handling.

### Risk: too many entry points dilute focus

Guardrail:

- keep one primary CTA per user state,
- personalize the dashboard instead of showing every option equally.

### Risk: leaders get more work without better tools

Guardrail:

- build triage views,
- assign ownership,
- show outstanding follow-up clearly.

## Practical implementation sequence for this repository

1. Update `app/page.tsx` messaging and layout to support broader community intent.
2. Restructure `app/dashboard/page.tsx` into a community home with modular sections.
3. Introduce new route shells for `/community`, `/care`, `/serve`, and `/groups`.
4. Add post-session connection prompts to `components/session/SessionWorkspace.tsx`.
5. Extend Supabase schema for care, groups, and serving workflows.
6. Add analytics events for each meaningful community action.

## Definition of done for the first UX pass

The first pass is successful when:

- a non-worship-team user can understand where to go from the landing page,
- the dashboard offers at least one worship action and one community action,
- users can request care and volunteer in a clear, trusted way,
- the live worship flow connects naturally to post-service community participation,
- leaders can see what needs response without manual coordination outside the app.
