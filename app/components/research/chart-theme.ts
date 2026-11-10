export const CHART_INK = "#15202B";
export const CHART_MUTED = "#5D6B78";
export const CHART_LINE = "#DCE3E8";
export const CHART_ACCENT = "#1F6F6A";
/** Extra fills for multi series / categorical bars on lab charts. */
export const CHART_SERIES = [
	"#1F6F6A",
	"#2F5D8C",
	"#C47A3A",
	"#5B7F5A",
	"#8B4D6B",
	"#3D6B8A",
	"#B85C38",
	"#4A7C59",
	"#6B5B95",
	"#D4A017",
] as const;

export const tooltipStyle = {
	backgroundColor: "#ffffff",
	border: "1px solid #DCE3E8",
	borderRadius: 2,
	fontSize: 13,
	color: CHART_INK,
};
