import { useState } from "react";

type FaqTag = {
	readonly label: string;
	readonly variant: "teal";
};

type FaqItem = {
	readonly question: string;
	readonly answer: string;
	readonly tags?: readonly FaqTag[];
};

type FaqGroup = {
	readonly title: string;
	readonly items: readonly FaqItem[];
};

function ChevronIcon({ open }: { open: boolean }) {
	return (
		<svg
			className={`mt-1 h-5 w-5 shrink-0 text-accent transition-transform duration-300 ${
				open ? "rotate-180" : ""
			}`}
			viewBox="0 0 20 20"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M5 7.5L10 12.5L15 7.5"
				stroke="currentColor"
				strokeWidth="1.75"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function FaqAccordionItem({
	item,
	id,
	isOpen,
	onToggle,
}: {
	item: FaqItem;
	id: string;
	isOpen: boolean;
	onToggle: (id: string) => void;
}) {
	const headingId = `faq-heading-${id}`;
	const panelId = `faq-panel-${id}`;

	return (
		<div className="faq-item border-t border-line last:border-b">
			<button
				type="button"
				id={headingId}
				className="faq-item-trigger"
				aria-expanded={isOpen}
				aria-controls={panelId}
				onClick={() => onToggle(id)}
			>
				<h2 className="font-display text-[1.45rem] leading-snug text-ink">
					{item.question}
				</h2>
				<ChevronIcon open={isOpen} />
			</button>
			{isOpen ? (
				<div
					id={panelId}
					role="region"
					aria-labelledby={headingId}
					className="pb-7 pr-8"
				>
					<p className="text-[0.97rem] leading-relaxed text-ink-soft">
						{item.answer}
					</p>
					{item.tags ? (
						<div className="mt-1">
							{item.tags.map((tag) => (
								<span key={tag.label} className="tag-teal">
									{tag.label}
								</span>
							))}
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

export function FaqAccordion({ groups }: { groups: readonly FaqGroup[] }) {
	const [openId, setOpenId] = useState<string | null>(null);

	const handleToggle = (id: string) => {
		setOpenId((current) => (current === id ? null : id));
	};

	return (
		<>
			{groups.map((group) => (
				<div key={group.title} className="mt-10 first:mt-0">
					<p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
						{group.title}
					</p>
					<ul className="mt-5 list-none p-0">
						{group.items.map((item) => {
							const id = `${group.title}::${item.question}`;
							return (
								<li key={item.question} className="list-none">
									<FaqAccordionItem
										item={item}
										id={id}
										isOpen={openId === id}
										onToggle={handleToggle}
									/>
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</>
	);
}
