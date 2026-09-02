import type { RichTextSegment } from "~/data/content";

export function RichText({
	segments,
	className,
}: {
	segments: readonly RichTextSegment[];
	className?: string;
}) {
	return (
		<p className={className}>
			{segments.map((segment, index) =>
				segment.emphasis ? (
					<em key={index} className="italic">{segment.text}</em>
				) : (
					<span key={index}>{segment.text}</span>
				),
			)}
		</p>
	);
}
