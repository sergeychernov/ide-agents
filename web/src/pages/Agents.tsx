import ArtifactListPage from "./ArtifactListPage";

export default function Agents() {
  return (
    <ArtifactListPage
      kind="agent"
      title="Agents"
      emptyHint="No agents found. Add a repo with an agents/ directory on the Settings page."
    />
  );
}
