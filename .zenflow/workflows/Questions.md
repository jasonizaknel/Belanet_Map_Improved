# Context-Grounded Question

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Purpose

This workflow is used to answer a **single plain-text question** provided in the task description.

All answers **must be grounded in repository context**, with `/docs` as the primary source of truth.

The agent **may** make assumptions or use external knowledge **only if**:
- The assumption or knowledge is explicitly stated
- A clear justification is provided
- The justification references either:
  - Repository documentation, or
  - Well-established external sources or standards

Unjustified assumptions are not permitted.

---

## Workflow Steps

### [ ] Step 1: Load Repository Context (Required)

**Objective:** Build sufficient understanding to answer the question accurately.

Actions:
- Read relevant files under `<repo root>/docs`
- Identify:
  - System purpose
  - Relevant components or workflows
  - Any documented constraints or assumptions related to the question

Rules:
- `/docs` must be consulted before answering
- If relevant documentation does not exist or is ambiguous, this must be explicitly noted

---

### [ ] Step 2: Answer the Question Using Context

**Objective:** Produce a direct, grounded answer to the task description.

Rules:
- Answer **only** the question asked
- Do not propose new features unless explicitly requested
- Base reasoning primarily on `/docs`
- Assumptions or external knowledge are allowed **only when justified and referenced**
- **If relevant documentation cannot be found, the agent must not answer the question**

Instead, the agent must:
- State that the answer cannot be determined from current documentation
- Identify exactly what documentation is missing or unclear

Deliverable:
- `{@artifacts_path}/answer.md`

The answer **must include**:
- A clear, direct response *or* an explicit inability to answer
- References to relevant documentation (file paths and sections)
- Explicit callouts for:
  - Assumptions made
  - External knowledge used
  - Documentation gaps, if any

---

## Exit Criteria

This task is complete when:
- The question has been answered or explicitly blocked due to missing context
- Documentation has been consulted and referenced
- All assumptions and external knowledge are clearly justified
