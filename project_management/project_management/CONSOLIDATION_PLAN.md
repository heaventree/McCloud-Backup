# Documentation Consolidation Plan

This document outlines the steps to consolidate documentation between the `project_management/` directory (with an underscore) and the `project-management/` directory (with a hyphen).

## Current Status

There are currently two separate documentation directories:

1. `project_management/` (with underscore) - New task management system with:
   - PLANNING.md
   - TASK.md
   - ROADMAP.md
   - ISSUES.md
   - CHANGELOG.md
   - AI_AGENT_GUIDELINES.md
   - MASTER_INDEX.md
   - project.index.json
   - README.md

2. `project-management/` (with hyphen) - Existing documentation with:
   - api_reference.md
   - api_troubleshooting_guide.md
   - gocardless_webhooks.md
   - master_development_guide.md
   - safety_and_backup_systems.md
   - super_prompt_template.md
   - testing_with_gocardless_cli.md
   - test-transactions.json
   - test-webhook.json
   - troubleshooting.md
   - usage_guide.md

## Consolidation Plan

### Step 1: Create Technical Documentation Section

Move all technical documentation from `project-management/` (with hyphen) to a new `project_management/technical/` directory:

```
mkdir -p project_management/technical/
cp project-management/*.md project_management/technical/
cp project-management/*.json project_management/technical/
```

### Step 2: Update Master Index

Update `project_management/MASTER_INDEX.md` to include links to the technical documentation now in the `technical/` subdirectory.

### Step 3: Create Symlinks for Backward Compatibility

Create symlinks in the original `project-management/` directory to point to the new locations, to maintain any existing references:

```
ln -sf ../project_management/PLANNING.md project-management/planning.md
ln -sf ../project_management/ROADMAP.md project-management/roadmap.md
ln -sf ../project_management/TASK.md project-management/tasks.md
ln -sf ../project_management/ISSUES.md project-management/issues.md
ln -sf ../project_management/CHANGELOG.md project-management/changelog.md
ln -sf ../project_management/README.md project-management/readme.md
```

### Step 4: Add Redirect Notice

Create a README file in the `project-management/` directory to explain that documentation has moved:

```
echo "# Documentation Moved

The documentation system has been reorganized. Please use the new system in the \`project_management/\` directory (with underscore).

All documentation in this directory is now maintained via symlinks for backward compatibility.
" > project-management/README.md
```

### Step 5: Update Documentation References

Update any references to documentation files in the codebase to point to the new locations.

### Step 6: Future Documentation Policy

Going forward:
- All project management documentation should be added to the `project_management/` directory
- Technical documentation should be added to the `project_management/technical/` directory
- The `project-management/` directory should only contain symlinks for backward compatibility

## Implementation Notes

This consolidation should be done in a single commit to minimize disruption.

The symlinks should be maintained until we can verify that all references to the old paths have been updated.