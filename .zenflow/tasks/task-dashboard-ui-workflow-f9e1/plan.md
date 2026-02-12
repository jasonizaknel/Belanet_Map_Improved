# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification
<!-- chat-id: ae4a521e-1fb4-4c2b-be02-a6819ad5acc1 -->

Assess the task's difficulty, as underestimating it leads to poor outcomes.
- easy: Straightforward implementation, trivial bug fix or feature
- medium: Moderate complexity, some edge cases or caveats to consider
- hard: Complex logic, many caveats, architectural considerations, or high-risk changes

Create a technical specification for the task that is appropriate for the complexity level:
- Review the existing codebase architecture and identify reusable components.
- Define the implementation approach based on established patterns in the project.
- Identify all source code files that will be created or modified.
- Define any necessary data model, API, or interface changes.
- Describe verification steps using the project's test and lint commands.

Save the output to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach
- Source code structure changes
- Data model / API / interface changes
- Verification approach

If the task is complex enough, create a detailed implementation plan based on `{@artifacts_path}/spec.md`:
- Break down the work into concrete tasks (incrementable, testable milestones)
- Each task should reference relevant contracts and include verification steps
- Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function).

Important: unit tests must be part of each implementation task, not separate tasks. Each task should implement the code and its tests together, if relevant.

Save to `{@artifacts_path}/plan.md`. If the feature is trivial and doesn't warrant this breakdown, keep the Implementation step below as is.

---

### [ ] Step: Subtask 1 — Task Card Information Hierarchy
- [ ] Update `updatePriorityTaskQueue()` to make priority the dominant element
- [ ] Compute and display task age (e.g., "Opened 2h ago") from `createdAt`
- [ ] De-emphasize secondary labels via subtle styles in `stylesheet.css`
- [ ] Verify task priority visibility and age without opening details

### [ ] Step: Subtask 2 — Task Age & SLA Risk Indicators
- [ ] Add `AppState.slaConfig` with defaults; persist to `localStorage`
- [ ] Add SLA config controls in Strategy panel (green/amber thresholds)
- [ ] Compute SLA risk (green/amber/red) per task and render subtle indicator on cards
- [ ] Ensure indicators update on data refresh and config change

### [ ] Step: Subtask 3 — Expandable Task Cards
- [ ] Add inline expansion on click/hover with smooth height transition
- [ ] Render full title/description, last updated, and assigned technician
- [ ] Keep expansion inline; avoid modals; maintain grid flow
- [ ] Validate no layout shift breaks prioritization view

### [ ] Step: Subtask 4 — Filtering & Sorting Controls
- [ ] Add filters: multi-select Priority, Status, Customer, Task Age buckets, Unassigned only
- [ ] Add sorting presets: Urgent First, Oldest First, Unassigned
- [ ] Combine filters deterministically; persist to `localStorage`
- [ ] Ensure instant reordering and filter combination correctness

### [ ] Step: Subtask 5 — Density Toggle
- [ ] Add Compact/Comfortable toggle in Priority Queue header
- [ ] Apply density class to cards for spacing/typography adjustments
- [ ] Persist selection per session
- [ ] Confirm readability and instant switching

### [ ] Step: Subtask 6 — Make Team Panel Actionable
- [ ] Keep drag-and-drop task → technician; refine visuals and drop affordances
- [ ] Display technician load state (Available/Busy/Overloaded) with thresholds
- [ ] Update load state immediately after assignment
- [ ] Validate sync between team panel and dashboard tasks

### [ ] Step: Subtask 7 — Technician Skills & Area Tags
- [ ] Render compact `skills` and `region/area` tags on technician tiles
- [ ] Use data if present; omit gracefully if missing
- [ ] Ensure tags are unobtrusive and scannable

### [ ] Step: Subtask 8 — Make Summary Metrics Interactive
- [ ] Make metrics clickable to set filters (Open Tickets, Critical Priority)
- [ ] Show active metric filter state and provide a clear reset action
- [ ] Confirm list updates instantly on interaction

### [ ] Step: Subtask 9 — Add Metric Trend Indicators
- [ ] Track short history in `AppState.metricsHistory`
- [ ] Compute deltas; render up/down caret with subtle delta text
- [ ] Validate trends reflect change since previous period

### [ ] Step: Subtask 10 — Refine Visual Language & Color Usage
- [ ] Reserve saturated colors for Critical priority and SLA risk
- [ ] Standardize icon usage and add tooltips for any ambiguous icons
- [ ] Calibrate neutral backgrounds/borders to reduce noise

### [ ] Step: Subtask 11 — Empty & Error States
- [ ] Distinguish "No tasks loaded yet" vs. "No tasks match filters"
- [ ] Provide reset/clear-filters control when filtered-empty
- [ ] Add concise guidance for invalid/missing data cases
