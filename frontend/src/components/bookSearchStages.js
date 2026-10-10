export function searchStageAfter(stage, action) {
  if (stage === "query" && action === "search-complete") return "results";
  if (stage === "editions" && action === "edition-has-chapters") return "review";
  if (stage === "editions" && action === "edition-needs-scan") return "scan";
  if (stage === "scan" && action === "scan-complete") return "review";
  if (stage === "review" && action === "save-complete") return "complete";
  return stage;
}