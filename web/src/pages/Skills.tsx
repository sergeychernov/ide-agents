import ArtifactListPage from "./ArtifactListPage";

export default function Skills() {
  return (
    <ArtifactListPage
      kind="skill"
      title="Skills"
      emptyHint="No skills found. Add a repo with a skills/ directory on the Settings page."
    />
  );
}
