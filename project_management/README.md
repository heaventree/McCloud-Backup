# Payymo Project Management System

This directory contains the Task Management System for the Payymo project, providing a structured approach to tracking project goals, tasks, progress, issues, and roadmap items.

## Directory Structure

- `README.md` - This file, providing an overview of the project management system
- `PLANNING.md` - Project vision, technical architecture, constraints, and scope
- `TASK.md` - Current tasks, their status, and progress tracking
- `project.index.json` - Machine-readable project structure for AI agent consumption
- `ROADMAP.md` - Long-term project goals and feature timelines
- `ISSUES.md` - Known issues, bugs, and their resolution status
- `CHANGELOG.md` - History of changes to the project

## How to Use This System

1. **For Developers:**
   - Review `PLANNING.md` to understand the project's vision and technical architecture
   - Check `TASK.md` for your assigned tasks and their status
   - Update task status as you make progress
   - Add any issues encountered to `ISSUES.md`
   - Document completed work in `CHANGELOG.md`

2. **For Project Managers:**
   - Use `ROADMAP.md` to track overall project progress
   - Update `TASK.md` with new tasks and prioritize the backlog
   - Review `ISSUES.md` to identify blockers and assign resources
   - Maintain `CHANGELOG.md` for customer-facing release notes

3. **For AI Agents:**
   - Reference `project.index.json` for machine-readable project structure
   - Follow the guidelines in `TASK.md` for task progress reporting
   - Adhere to the project architecture defined in `PLANNING.md`
   - Document changes according to the Conventional Commits standard

## Integration with Other Systems

This task management system integrates with:

1. **Version Control**: 
   - Commit messages should reference task IDs (e.g., "feat(auth): Implement login flow #PM-123")
   - Pull Requests should link to tasks they complete

2. **CI/CD Pipeline**:
   - Automated tests and deployments track progress on tasks
   - Build status is reflected in task updates

3. **Documentation**:
   - Technical documentation in the `/md_docs` directory should be updated as tasks are completed
   - User-facing documentation should reflect completed roadmap items

## Backup and Recovery

The project management system is backed up along with the codebase:
- Manual snapshots via `save_approved.py` 
- Automated backups via `backup_chat.py`
- Recovery via `rollback_to_approved.py` if needed