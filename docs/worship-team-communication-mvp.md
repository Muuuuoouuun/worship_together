# Worship Team Communication MVP

## Goal

Help a worship team prepare faithfully before rehearsal by making the weekly worship direction, responsibilities, notices, setlist flow, and readiness checks visible in one place.

## MVP outcome

A leader should be able to open the dashboard and answer four questions without searching through chat:

- What is the direction of this week's worship?
- What songs, keys, flow notes, and service details should the team know?
- Who has read the notice and reviewed the setlist?
- Who needs leader follow-up before rehearsal?

## Product guidance

The product should not become a generic checklist app. Its purpose is to help the team prepare worship with shared understanding, clear responsibilities, and gracious follow-up.

Core principles:

- keep worship direction visible before task status,
- make readiness transparent without shaming people,
- separate live-session cues from pre-service preparation,
- keep sensitive care or conflict items private by default,
- give leaders a short follow-up queue instead of another noisy feed,
- prefer one clear next action per member.

The progression should be:

- MVP: show who has read the notice and reviewed the setlist.
- Advanced: show what each person understands, what is blocked, and where the leader should step in.

## Priority order

### 1. Weekly worship preparation board

This is the first MVP slice because the current app already has setlists, songs, and live sessions. The fastest useful product move is to connect those pieces into a pre-service preparation surface.

Included:

- worship date, title, theme, scripture, and prayer focus,
- setlist order with key, BPM, links, and song-level notes,
- rehearsal time, call time, and service notes,
- team announcement area.

### 2. Notice and setlist readiness

This is the newly added dashboard slice.

Included:

- member-by-member notice read state,
- member-by-member setlist reviewed state,
- personal practice readiness,
- service-notes confirmation,
- clear "needs help" status for leader follow-up.

Current implementation:

- `components/dashboard/TeamPreparationStatus.tsx`
- rendered from `app/dashboard/page.tsx`
- uses demo data until team membership and preparation responses are backed by Supabase.

### 3. Role and responsibility assignments

Add per-service assignments instead of relying on generic team membership.

Suggested fields:

- service ID,
- user ID,
- role label,
- part or instrument,
- arrival time,
- preparation note,
- required checks.

### 4. Gracious feedback and post-service review

Keep live session feedback focused on cues. Add a separate post-service reflection flow with:

- gratitude,
- what to align next time,
- prayer needs,
- leader-only follow-up.

### 5. Prayer, care, and private follow-up

Build after the prep workflow is stable because this requires privacy, moderation, and role-based visibility.

Included later:

- prayer request visibility levels,
- urgency,
- assigned care owner,
- follow-up status,
- private leader note.

## Advanced roadmap

### P0. Real readiness actions

Replace demo readiness data with member actions.

Member actions:

- mark notice as read,
- mark setlist as reviewed,
- mark personal practice as ready,
- confirm service notes,
- flag "needs help" with a short note.

Leader view:

- all members,
- pending notice,
- pending setlist review,
- needs help,
- ready.

### P0. Worship preparation brief

Attach a preparation brief to each setlist so the team can understand why the songs were chosen, not only what to play.

Brief fields:

- scripture reference,
- worship theme,
- prayer focus,
- worship flow explanation,
- leader note,
- service-specific notes,
- rehearsal time,
- call time.

### P1. Service role assignments

Add per-service roles instead of relying only on team membership.

Role examples:

- worship leader,
- vocal,
- keys,
- guitar,
- bass,
- drums,
- sound,
- slides,
- broadcast,
- sheet or chart owner.

Each assignment should support:

- role label,
- part label,
- call time,
- preparation note,
- attendance status,
- substitute or conflict note.

### P1. Song and part communication

Keep song-specific discussion attached to the song instead of sending everything into a shared chat.

Song-level fields:

- intro,
- ending,
- repeats,
- bridge cue,
- vocal harmony note,
- band cue,
- sound cue,
- slide cue,
- reference link,
- leader transition note.

### P1. Leader follow-up queue

The leader should have a small queue of items that need attention before rehearsal.

Queue sources:

- unchecked notice,
- unchecked setlist review,
- needs-help flag,
- attendance change,
- unclear song cue,
- missing role assignment.

Queue actions:

- mark resolved,
- assign owner,
- add private note,
- send reminder.

### P2. Reminders

Keep reminders limited and predictable.

Default reminders:

- when a setlist or preparation brief is published,
- one day before worship for members with pending checks.

Optional reminders:

- rehearsal morning call-time reminder,
- leader summary for unresolved follow-up items.

### P2. Post-service review

Add a short reflection flow after worship.

Prompts:

- what are we thankful for,
- what should we align next time,
- what should we pray for,
- what should only the leader see.

This should feel pastoral, not like a performance rating form.

### P3. Prayer, care, and conflict follow-up

Add this after the prep workflow has real users and stable permissions.

Required guardrails:

- privacy level,
- role-based visibility,
- urgency,
- assigned responder,
- status,
- audit trail for sensitive follow-up.

## Data model proposal

### `service_preparation`

Stores the weekly worship preparation brief.

- `id`
- `team_id`
- `setlist_id`
- `scripture_reference`
- `worship_direction`
- `prayer_focus`
- `announcement`
- `rehearsal_time`
- `call_time`
- `created_by`
- `created_at`
- `updated_at`

### `service_assignments`

Stores member responsibilities for a service.

- `id`
- `team_id`
- `setlist_id`
- `user_id`
- `role_label`
- `part_label`
- `arrival_time`
- `preparation_note`
- `status`
- `created_at`
- `updated_at`

### `service_readiness_checks`

Stores each member's preparation state.

- `id`
- `team_id`
- `setlist_id`
- `user_id`
- `notice_read_at`
- `setlist_reviewed_at`
- `practice_ready_at`
- `service_notes_checked_at`
- `needs_help`
- `help_note`
- `updated_at`

## Implementation sequence

1. Add the dashboard readiness component with demo data.
2. Add the worship preparation brief to the setlist planning flow.
3. Add Supabase tables for preparation, assignments, and readiness checks.
4. Replace demo readiness data with team-scoped reads.
5. Add member actions to mark notice and setlist checks complete.
6. Add "needs help" notes and a leader follow-up queue.
7. Add leader filters for pending, needs help, and ready.
8. Add song-level preparation notes.
9. Add notifications or reminders for unchecked members before rehearsal.
10. Add post-service review after the prep workflow is stable.

## Definition of done

- Leaders can see notice and setlist readiness by member.
- Members can understand what they need to confirm before rehearsal.
- "Needs help" is visible without public shaming.
- The feature lives next to the worship/setlist workflow, not in a separate generic feed.
