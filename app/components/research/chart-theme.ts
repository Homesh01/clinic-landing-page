import type { VaccinePlatform } from "~/data/synthetic-vaccine-research";

export const PLATFORM_COLORS: Record<VaccinePlatform, string> = {
	"Personalised mRNA": "#1F6F6A",
	"Neoantigen peptide": "#2A3644",
	"Dendritic cell": "#5D6B78",
	"Other investigational": "#8FA0AB",
};

export const CHART_INK = "#15202B";
export const CHART_MUTED = "#5D6B78";
export const CHART_LINE = "#DCE3E8";
export const CHART_ACCENT = "#1F6F6A";

export const tooltipStyle = {
	backgroundColor: "#ffffff",
	border: "1px solid #DCE3E8",
	borderRadius: 2,
	fontSize: 13,
	color: CHART_INK,
};
