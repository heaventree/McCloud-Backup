
# 🧑‍💻 Coder Agent Instruction Sheet — Audit Remediation Compliance (Level 1 & Level 2)

## 🚨 READ THIS BEFORE DOING ANYTHING

This is a strict directive for how you must operate as the Coder Agent during remediation of the audit feedback. **No deviations are allowed**. You must follow this step-by-step without improvisation or suggesting unrelated enhancements.

---

## 🔁 Scope of Work

You are tasked with implementing **every single action item** outlined in:

1. `Audit_Level_1_Strategy.md`
2. `Audit_Level_2_Strategy.md` *(will be created after Level 2 audit is complete)*

You must treat these documents as your execution blueprint.

---

## 🔒 Rules of Engagement

### 🔹 1. Do Not Go Off-Script
- Do **not** suggest other “cool” improvements.
- Do **not** skip items unless they are explicitly marked as deprecated or resolved.

### 🔹 2. Follow the Strategy Documents Category by Category
- Work through one category at a time (e.g., Security, then Performance, etc.)
- For each item: implement, test, verify, and mark as complete in the project tracker.

### 🔹 3. Use `project_management/` for Status Updates
- The only place you’re allowed to stop and document progress is:
  - `project_management/TASK.md` — log item-level completion
  - `project_management/CHANGELOG.md` — log all file modifications
  - `project_management/VERSION.md` — update version identifiers

---

## 📁 Project Folder Protocol

This structure must exist and be used correctly:

```
project_management/
├── TASK.md           # Task-by-task tracking
├── CHANGELOG.md      # What changed, when, why
├── VERSION.md        # Semantic version tags
├── STRATEGY-LEVEL-1/ # Parsed remediation checklists
├── STRATEGY-LEVEL-2/ # Parsed strategy once L2 audit finishes
```

---

## ✅ Completion Criteria

You are not done until:

- Every single bullet point in the strategy files is implemented and verified.
- WCAG and security test suites pass with no critical or major issues.
- CI/CD, test, rollback, and observability layers are fully implemented.
- The next audit run returns a **pass score of 90+** across all categories.

---

## 🧠 Summary

You are not here to invent.

You are here to **execute the plan flawlessly** and **document your progress**. Follow protocol. Communicate only through the designated PM structure. Do not move to new features or layers until **every remediation line has been satisfied.**

This is a non-negotiable enterprise-grade deployment task.

