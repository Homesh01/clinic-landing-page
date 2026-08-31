import { NavLink } from "@remix-run/react";
import { useEffect, useState } from "react";
import { nav, site } from "~/data/content";

function NavItem({
	item,
	onNavigate,
}: {
	item: (typeof nav)[number];
	onNavigate: () => void;
}) {
	const className = ({ isActive }: { isActive: boolean }) =>
		`text-[0.92rem] tracking-wide transition-colors ${
			isActive
				? "font-semibold text-accent"
				: "text-ink-soft hover:text-accent"
		}`;

	if ("hash" in item && item.hash) {
		return (
			<a href={item.to} className={className({ isActive: false })} onClick={onNavigate}>
				{item.label}
			</a>
		);
	}

	return (
		<NavLink to={item.to} className={className} onClick={onNavigate}>
			{item.label}
		</NavLink>
	);
}

export function Header() {
	const [open, setOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 12);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		document.body.style.overflow = open ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	const close = () => setOpen(false);

	return (
		<header
			className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
				scrolled || open
					? "border-line bg-white/95 backdrop-blur-md"
					: "border-transparent bg-white/70 backdrop-blur-sm"
			}`}
		>
			<div className="site-container flex h-[4.25rem] items-center justify-between gap-6">
				<NavLink to="/" className="group min-w-0" onClick={close}>
					<span className="block font-display text-[1.55rem] leading-none tracking-tight text-ink transition-colors group-hover:text-accent">
						{site.name}
					</span>
					<span className="mt-1 block truncate text-[0.7rem] uppercase tracking-[0.16em] text-ink-muted">
						{site.title}
					</span>
				</NavLink>

				<nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
					{nav.map((item) => (
						<NavItem key={item.to} item={item} onNavigate={close} />
					))}
					<NavLink to="/book" className="btn-primary !px-4 !py-2 text-sm">
						Book appointment
					</NavLink>
				</nav>

				<button
					type="button"
					className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-line text-ink lg:hidden"
					aria-expanded={open}
					aria-controls="mobile-nav"
					aria-label={open ? "Close menu" : "Open menu"}
					onClick={() => setOpen((value) => !value)}
				>
					<span className="sr-only">Menu</span>
					<div className="flex w-5 flex-col gap-1.5">
						<span
							className={`h-px w-full bg-current transition ${
								open ? "translate-y-[3.5px] rotate-45" : ""
							}`}
						/>
						<span
							className={`h-px w-full bg-current transition ${
								open ? "opacity-0" : ""
							}`}
						/>
						<span
							className={`h-px w-full bg-current transition ${
								open ? "-translate-y-[3.5px] -rotate-45" : ""
							}`}
						/>
					</div>
				</button>
			</div>

			<div
				id="mobile-nav"
				className={`border-t border-line bg-white lg:hidden ${
					open ? "block" : "hidden"
				}`}
			>
				<nav
					className="site-container flex flex-col gap-1 py-4"
					aria-label="Mobile"
				>
					{nav.map((item) => {
						if ("hash" in item && item.hash) {
							return (
								<a
									key={item.to}
									href={item.to}
									onClick={close}
									className="rounded-sm px-3 py-3 text-base text-ink-soft"
								>
									{item.label}
								</a>
							);
						}
						return (
							<NavLink
								key={item.to}
								to={item.to}
								onClick={close}
								className={({ isActive }) =>
									`rounded-sm px-3 py-3 text-base ${
										isActive
											? "bg-accent-soft font-semibold text-accent"
											: "text-ink-soft"
									}`
								}
							>
								{item.label}
							</NavLink>
						);
					})}
					<NavLink to="/book" onClick={close} className="btn-primary mt-2 justify-center">
						Book appointment
					</NavLink>
				</nav>
			</div>
		</header>
	);
}
