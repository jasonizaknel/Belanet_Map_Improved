# TeamSidebar.js — File

- Name: TeamSidebar.js
- Path: ./User Interface/TeamSidebar.js
- Type: JavaScript (browser)

## Purpose & Responsibility
Implements team management UI: fetch administrators, add/remove members, render lists and details, compute workloads, and support drag-and-drop assignment.

## Internal Structure
- `fetchAdministrators` (lines ~1–13): GET `/api/administrators` with admin token header
- `renderAdminDropdown` (lines ~15–36): builds dropdown of admins
- `addTeamMember`/`saveTeamMembers`/`loadTeamMembers` (lines ~38–64): persistence via localStorage
- `renderTeamMembers` (lines ~66–156): renders cards, DnD handlers, icons
- `removeTeamMember`/`clearTeamMembers` (lines ~158–183): manage roster
- `showMemberDetails` and `updateMemberStats` (lines ~185–242): compute tasks and distances from tracker
- Helpers: `calculateDistance`, `renderMemberTasks`, `viewTaskOnMap`, `handleAutoAssign` (lines ~243+)

## Dependency Mapping
- Inbound: AppState, DOM elements in map.html, lucide for icons
- Outbound: `/api/tasks/assign`, `/api/administrators`, `fetchTasks`

## Bug & Risk Notes
- Distance calculation relies on customer.gps format; add guards for invalid data
- Uses string comparisons to match tracker names to admins; may be brittle

## Deletion & Cleanup Suggestions
- None