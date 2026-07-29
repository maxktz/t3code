import type { ScopedProjectRef } from "@t3tools/contracts";
import { scopedProjectKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import { ChevronDownIcon, FolderPlusIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

import { openCommandPalette } from "~/commandPaletteBus";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useClientSettings } from "~/hooks/useSettings";
import { selectProjectGroupingSettings } from "~/logicalProject";
import {
  buildSidebarProjectPickerEntries,
  buildSidebarProjectSnapshots,
} from "~/sidebarProjectGrouping";
import { useProjects, useThreadShells } from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { cn } from "~/lib/utils";
import { sortLogicalProjectsForSidebar } from "../Sidebar.logic";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";

interface DraftHeroHeadlineProps {
  readonly activeProjectRef: ScopedProjectRef | null;
  readonly activeProjectTitle: string | null;
  readonly activeProjectCwd: string | null;
}

function projectDirectoryLabel(cwd: string | null, fallbackTitle: string | null): string {
  if (cwd && cwd.trim().length > 0) {
    return cwd;
  }
  return fallbackTitle ?? "Choose a project";
}

export function DraftHeroHeadline({
  activeProjectRef,
  activeProjectTitle,
  activeProjectCwd,
}: DraftHeroHeadlineProps) {
  const projects = useProjects();
  const threads = useThreadShells();
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const projectGroupingSettings = useClientSettings(selectProjectGroupingSettings);
  const projectSortOrder = useClientSettings((settings) => settings.sidebarProjectSortOrder);
  const handleNewThread = useNewThreadHandler();
  const openAddProject = useCallback(() => openCommandPalette({ open: "add-project" }), []);

  const environmentLabelById = useMemo(
    () =>
      new Map(
        environments.map((environment) => [environment.environmentId, environment.label] as const),
      ),
    [environments],
  );
  const projectGroups = useMemo(
    () =>
      sortLogicalProjectsForSidebar(
        buildSidebarProjectSnapshots({
          projects,
          settings: projectGroupingSettings,
          primaryEnvironmentId,
          resolveEnvironmentLabel: (environmentId) =>
            environmentLabelById.get(environmentId) ?? null,
        }),
        threads,
        projectSortOrder,
      ),
    [
      environmentLabelById,
      primaryEnvironmentId,
      projectGroupingSettings,
      projectSortOrder,
      projects,
      threads,
    ],
  );
  const projectPickerEntries = useMemo(
    () =>
      buildSidebarProjectPickerEntries({
        groups: projectGroups,
        preferredProjectRef: activeProjectRef,
      }),
    [activeProjectRef, projectGroups],
  );
  const projectEntryByKey = useMemo(
    () => new Map(projectPickerEntries.map((entry) => [entry.group.projectKey, entry] as const)),
    [projectPickerEntries],
  );
  const activeProjectGroup =
    activeProjectRef === null
      ? null
      : (projectGroups.find((group) =>
          group.memberProjectRefs.some(
            (projectRef) => scopedProjectKey(projectRef) === scopedProjectKey(activeProjectRef),
          ),
        ) ?? null);
  const activeProjectKey = activeProjectGroup?.projectKey ?? "";
  const activeProjectDisplayName = activeProjectGroup?.displayName ?? activeProjectTitle;
  const hasResolvedProject = activeProjectTitle !== null;
  const canChooseProject = projectPickerEntries.length > 0;
  const shouldShowProjectMenu = canChooseProject;
  const directoryLabel = projectDirectoryLabel(
    activeProjectCwd,
    activeProjectDisplayName ?? activeProjectTitle,
  );

  const triggerClassName = cn(
    "pointer-events-auto inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1 rounded-sm text-left text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
    !hasResolvedProject && "text-muted-foreground/70 hover:text-muted-foreground",
  );

  const triggerContent = (
    <>
      <span className="min-w-0 truncate">{directoryLabel}</span>
      <ChevronDownIcon aria-hidden className="size-3 shrink-0 opacity-70" />
    </>
  );

  const projectSelector = shouldShowProjectMenu ? (
    <Menu>
      <MenuTrigger
        aria-label={hasResolvedProject ? "Change project" : "Choose a project"}
        className={triggerClassName}
      >
        {triggerContent}
      </MenuTrigger>
      <MenuPopup align="start" className="max-h-80 min-w-40! w-max max-w-72 overflow-y-auto">
        <MenuRadioGroup
          value={activeProjectKey}
          onValueChange={(value) => {
            const entry = projectEntryByKey.get(value as string);
            if (!entry || value === activeProjectKey) {
              return;
            }
            const project = entry.targetProject;
            void handleNewThread(scopeProjectRef(project.environmentId, project.id), {
              replace: true,
            });
          }}
        >
          {projectPickerEntries.map(({ group }) => {
            return (
              <MenuRadioItem key={group.projectKey} value={group.projectKey} closeOnClick>
                <span className="min-w-0 truncate">{group.displayName}</span>
              </MenuRadioItem>
            );
          })}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onClick={openAddProject}>
          <FolderPlusIcon />
          New project
        </MenuItem>
      </MenuPopup>
    </Menu>
  ) : (
    <button type="button" onClick={openAddProject} className={triggerClassName}>
      {triggerContent}
    </button>
  );

  // Compact project-selector row above the new-thread composer.
  return <div className="flex w-full min-w-0 items-center justify-start">{projectSelector}</div>;
}
