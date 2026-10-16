import { NavLink, useLocation } from "@remix-run/react";
import { useEffect, useId, useRef, useState } from "react";
import { isNavGroup, nav, type NavLinkItem } from "~/data/content";

const BRAND = "Personalised Cancer Care";

function linkClass({ isActive }: { isActive: boolean }) {
	return `text-[1.05rem] tracking-wide transition-colors ${
		isActive
			? "font-semibold text-accent"
			: "text-ink-soft hover:text-accent"
	}`;
}

function DesktopDropdown({
	label,
	items,
}: {
	label: string;
	items: readonly NavLinkItem[];
}) {
	const [open, setOpen] = useState(false);
	const menuId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const location = useLocation();
	const childActive = items.some((child) =>
		location.pathname.startsWith(child.to),
	);

	useEffect(() => {
		setOpen(false);
	}, [location.pathname]);

	useEffect(() => {
		if (!open) return;
		function onPointerDown(event: MouseEvent) {
			if (!rootRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		}
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	return (
		<div
			ref={rootRef}
			className="relative"
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
		>
			<button
				type="button"
				className={`${linkClass({ isActive: childActive })} inline-flex items-center gap-1`}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-controls={menuId}
				onClick={() => setOpen((value) => !value)}
			>
				{label}
				<span className="text-[0.7rem] text-ink-muted" aria-hidden="true">
					{open ? "▴" : "▾"}
				</span>
			</button>
			<div
				id={menuId}
				role="menu"
				aria-label={label}
				className={`absolute left-1/2 top-full z-50 min-w-[16rem] -translate-x-1/2 pt-2 transition ${
					open
						? "pointer-events-auto opacity-100"
						: "pointer-events-none opacity-0"
				}`}
			>
				<div className="border border-line bg-white py-1 shadow-[0_12px_32px_rgba(21,32,43,0.08)]">
					{items.map((child) => (
						<NavLink
							key={child.to}
							to={child.to}
							role="menuitem"
							className={({ isActive }) =>
								`block whitespace-nowrap px-4 py-2.5 transition-colors ${
									isActive
										? "bg-accent-soft"
										: "hover:bg-mist/70"
								}`
							}
							onClick={() => setOpen(false)}
						>
							<span
								className={`block text-[1.02rem] ${
									location.pathname.startsWith(child.to)
										? "font-semibold text-accent"
										: "font-medium text-ink"
								}`}
							>
								{child.label}
							</span>
						</NavLink>
					))}
				</div>
			</div>
		</div>
	);
}

export function Header() {
	const [open, setOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const [mobileLabOpen, setMobileLabOpen] = useState(false);
	const location = useLocation();

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

	useEffect(() => {
		setOpen(false);
		setMobileLabOpen(false);
	}, [location.pathname]);

	const close = () => setOpen(false);

	return (
		<header
			className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
				scrolled || open
					? "border-line bg-white/95 backdrop-blur-md"
					: "border-transparent bg-white/70 backdrop-blur-sm"
			}`}
		>
			<div className="mx-auto flex w-full max-w-[100rem] items-center gap-4 px-3 py-1.5 sm:px-4 lg:px-5 lg:py-2">
				<div className="flex min-w-0 flex-1 items-center">
					<NavLink
						to="/"
						className="group inline-flex min-w-0 items-center leading-none"
						onClick={close}
						aria-label={BRAND}
					>
						<img
							src="/logo-mark.png"
							alt=""
							width={160}
							height={111}
							className="h-12 w-auto transition-opacity group-hover:opacity-90 sm:hidden"
							decoding="async"
						/>
						<img
							src="/main-logo-1.png"
							alt=""
							width={320}
							height={120}
							className="hidden h-[3.75rem] w-auto max-w-[min(100%,22rem)] transition-opacity group-hover:opacity-90 sm:block lg:h-[4.25rem] lg:max-w-[25rem]"
							decoding="async"
						/>
					</NavLink>
				</div>

				<nav
					className="hidden shrink-0 items-center gap-4 lg:flex xl:gap-5 2xl:gap-7"
					aria-label="Primary"
				>
					{nav.map((item) =>
						isNavGroup(item) ? (
							<DesktopDropdown
								key={item.label}
								label={item.label}
								items={item.children}
							/>
						) : (
							<NavLink
								key={item.to}
								to={item.to}
								className={linkClass}
								onClick={close}
							>
								{item.label}
							</NavLink>
						),
					)}
				</nav>

				<div className="flex flex-1 items-center justify-end gap-3">
					<NavLink
						to="/book"
						className="btn-primary hidden !px-4 !py-2.5 text-[1.05rem] whitespace-nowrap lg:inline-flex"
					>
						Book a consultation
					</NavLink>

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
			</div>

			<div
				id="mobile-nav"
				className={`border-t border-line bg-white lg:hidden ${
					open ? "block" : "hidden"
				}`}
			>
				<nav
					className="mx-auto flex w-full max-w-[100rem] flex-col gap-1 px-3 py-4 sm:px-4 lg:px-5"
					aria-label="Mobile"
				>
					{nav.map((item) =>
						isNavGroup(item) ? (
							<div key={item.label} className="rounded-sm">
								<button
									type="button"
									className={`flex w-full items-center justify-between rounded-sm px-3 py-3 text-left text-[1.1rem] ${
										item.children.some((child) =>
											location.pathname.startsWith(child.to),
										)
											? "bg-accent-soft font-semibold text-accent"
											: "text-ink-soft"
									}`}
									aria-expanded={mobileLabOpen}
									onClick={() => setMobileLabOpen((value) => !value)}
								>
									{item.label}
									<span aria-hidden="true">{mobileLabOpen ? "−" : "+"}</span>
								</button>
								{mobileLabOpen ? (
									<div className="mb-1 ml-2 border-l border-line pl-2">
										{item.children.map((child) => (
											<NavLink
												key={child.to}
												to={child.to}
												onClick={close}
												className={({ isActive }) =>
													`block rounded-sm px-3 py-3 text-[1.05rem] ${
														isActive
															? "bg-accent-soft font-semibold text-accent"
															: "text-ink-soft"
													}`
												}
											>
												{child.label}
											</NavLink>
										))}
									</div>
								) : null}
							</div>
						) : (
							<NavLink
								key={item.to}
								to={item.to}
								onClick={close}
								className={({ isActive }) =>
									`rounded-sm px-3 py-3 text-[1.1rem] ${
										isActive
											? "bg-accent-soft font-semibold text-accent"
											: "text-ink-soft"
									}`
								}
							>
								{item.label}
							</NavLink>
						),
					)}
					<NavLink
						to="/book"
						onClick={close}
						className="btn-primary mt-2 justify-center"
					>
						Book a consultation
					</NavLink>
				</nav>
			</div>
		</header>
	);
}
