# Worship Together Development Plan

## Delivered in this pass

- Dashboard session entry now supports both starting and rejoining a live session.
- `/session/[id]` now renders a real session workspace instead of a placeholder.
- Live state is stored in Zustand, synced from Supabase Realtime, and can be advanced by a local leader.
- `/dashboard/songs` now provides song creation, setlist planning, and library/status views.
- Song-level BPM presets and live blink-metronome controls now sync into the session flow.
- Landing copy, metadata, and setlist display text were cleaned up to remove obvious placeholder issues.

## Next product milestones

### 1. Worship score experience

- Render MusicXML with VexFlow in the live session canvas.
- Add page thumbnails, zoom presets, and device-friendly stage mode.
- Support conductor annotations and highlight layers per song.

### 2. Team workflow

- Replace demo team IDs with Supabase auth and real team membership.
- Add team roles for leader, musician, singer, and viewer.
- Build team roster, attendance, and invitation flows.

### 3. Setlist operations

- Create setlist CRUD screens and drag-and-drop song ordering.
- Add song upload, metadata editing, and storage integration.
- Track rehearsal notes, cue defaults, and service templates.

### 4. Practice and media

- Use `react-player` for rehearsal audio tracks and section loops.
- Provide personal practice mode that can detach from live sync by design.
- Add click tracks, count-ins, and practice history.

## Engineering track

### Stability

- Add seed data for local demos.
- Introduce route-level error boundaries and empty-state coverage.
- Add optimistic action error handling and user-facing toast feedback.

### Quality

- Add component tests for session state transitions.
- Add integration coverage for session start, update, and end flows.
- Add CI for `npm run lint` and `npm run build`.

### Operations

- Split env handling for local, preview, and production.
- Add analytics for session adoption and drop-off points.
- Add monitoring for Supabase Realtime connection health.
