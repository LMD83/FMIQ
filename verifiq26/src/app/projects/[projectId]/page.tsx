import { ProjectDashboard } from "./ProjectDashboard";
import type { Id } from "@/convex/_generated/dataModel";

export default function ProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  return (
    <ProjectDashboard projectId={params.projectId as Id<"projects">} />
  );
}
