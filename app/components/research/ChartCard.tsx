import type { ReactNode, Ref } from "react";

type ChartCardProps = {
	title: string;
	explanation: string;
	children: ReactNode;
	chartRef?: Ref<HTMLDivElement>;
	onExportPng?: () => void;
	actions?: ReactNode;
	/** Defaults to synthetic demo labelling used across Research Lab pages. */
	datasetLabel?: string;
};

export function ChartCard({
	title,
	explanation,
	children,
	chartRef,
	onExportPng,
	actions,
	datasetLabel = "Synthetic demonstration data",
}: ChartCardProps) {
	return (
		<section className="border border-line bg-white">
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
				<div>
					<h3 className="font-display text-xl text-ink sm:text-2xl">{title}</h3>
					<p className="mt-1 text-sm text-ink-muted">
						Dataset: {datasetLabel}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{actions}
					{onExportPng ? (
						<button
							type="button"
							className="btn-secondary !px-3 !py-2 text-sm"
							onClick={onExportPng}
						>
							Export PNG
						</button>
					) : null}
				</div>
			</div>
			<div ref={chartRef} className="px-2 py-4 sm:px-4">
				{children}
			</div>
			<p className="border-t border-line px-5 py-4 text-sm leading-relaxed text-ink-soft sm:px-6">
				<span className="font-semibold text-ink">
					What does this figure show us?{" "}
				</span>
				{explanation}
			</p>
		</section>
	);
}

export function exportSvgAsPng(
	container: HTMLElement | null,
	filename: string,
) {
	if (!container) return;
	const svg = container.querySelector("svg");
	if (!svg) return;

	const cloned = svg.cloneNode(true) as SVGSVGElement;
	const bbox = svg.getBoundingClientRect();
	const width = Math.max(1, Math.round(bbox.width));
	const height = Math.max(1, Math.round(bbox.height));
	cloned.setAttribute("width", String(width));
	cloned.setAttribute("height", String(height));
	cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");

	const serialiser = new XMLSerializer();
	const source = serialiser.serializeToString(cloned);
	const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const image = new Image();

	image.onload = () => {
		const canvas = document.createElement("canvas");
		canvas.width = width * 2;
		canvas.height = height * 2;
		const context = canvas.getContext("2d");
		if (!context) {
			URL.revokeObjectURL(url);
			return;
		}
		context.fillStyle = "#ffffff";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.scale(2, 2);
		context.drawImage(image, 0, 0, width, height);
		URL.revokeObjectURL(url);

		const link = document.createElement("a");
		link.download = filename;
		link.href = canvas.toDataURL("image/png");
		link.click();
	};

	image.onerror = () => URL.revokeObjectURL(url);
	image.src = url;
}
