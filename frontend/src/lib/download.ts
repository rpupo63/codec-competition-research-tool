import type { IntelDossier, CompetitorData, CompetitorDrilldown } from "@/types/codec";

interface Message {
  id: number;
  sender: string;
  text: string;
  isReasoning?: boolean;
}

export function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateConversationSummary(
  competitor: CompetitorData,
  messages: Message[],
  drilldown?: CompetitorDrilldown,
): string {
  const divider = "═".repeat(60);
  const subDivider = "─".repeat(40);

  let content = `${divider}\n`;
  content += `  INTEL BRIEFING: ${competitor.name}\n`;
  content += `  THREAT LEVEL: ${competitor.threat_level}\n`;
  content += `  STATUS: ${competitor.status}\n`;
  content += `${divider}\n\n`;

  if (drilldown) {
    content += `ANALYSIS\n${subDivider}\n`;
    content += `${drilldown.finalAnalysis}\n\n`;

    content += `MARKET SHARE: ${drilldown.details.marketShare}\n\n`;

    content += `KEY PRODUCTS:\n`;
    for (const product of drilldown.details.keyProducts || []) {
      content += `  • ${product}\n`;
    }
    content += `\n`;

    content += `WEAKNESSES:\n`;
    for (const weakness of drilldown.details.weaknesses || []) {
      content += `  • ${weakness}\n`;
    }
    content += `\n`;

    content += `RECOMMENDATION:\n  ${drilldown.details.recommendation}\n\n`;
  }

  content += `COMMUNICATION LOG\n${subDivider}\n`;
  for (const msg of messages) {
    if (msg.isReasoning) continue;
    content += `[${msg.sender}]: ${msg.text}\n\n`;
  }

  return content;
}

export function generateDossierReport(dossier: IntelDossier): string {
  const divider = "═".repeat(60);
  const subDivider = "─".repeat(40);

  let content = `${divider}\n`;
  content += `  ${dossier.classification}\n`;
  content += `  OPERATION: ${dossier.operationName}\n`;
  content += `  TARGET: ${dossier.targetCompany}\n`;
  content += `  DATE: ${new Date(dossier.dateCompiled).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}\n`;
  content += `${divider}\n\n`;

  content += `COMPETITOR MATRIX\n${subDivider}\n\n`;
  for (const entry of dossier.matrix) {
    content += `${entry.name}\n`;
    content += `  Threat Level:    ${entry.threat_level}\n`;
    content += `  Market Share:    ${entry.marketShare}\n`;
    content += `  Key Strength:    ${entry.keyStrength}\n`;
    content += `  Primary Product: ${entry.primaryProduct}\n`;
    content += `  AI Capability:   ${entry.aiCapability}\n\n`;
  }

  content += `\nVULNERABILITY MAP\n${subDivider}\n\n`;
  for (const entry of dossier.vulnerabilities || []) {
    content += `${entry.competitor}\n`;
    for (const gap of entry.gaps) {
      content += `  ◆ ${gap}\n`;
    }
    content += `\n`;
  }

  content += `\nSTRIKE PLAN\n${subDivider}\n\n`;
  for (const entry of dossier.strikePlan) {
    content += `CODENAME: ${entry.codename} [PRIORITY: ${entry.priority}]\n`;
    content += `  Target:    ${entry.target}\n`;
    content += `  Objective: ${entry.objective}\n`;
    content += `  Approach:  ${entry.approach}\n`;
    content += `  Timeline:  ${entry.timeline}\n\n`;
  }

  return content;
}
