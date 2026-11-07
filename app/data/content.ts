export const site = {
	/** Patient-facing practice brand (hero identity). */
	brand: "Personalised Cancer Care",
	/** Named clinical lead; not the primary brand mark. */
	name: "Dr Karen Sayal",
	title: "Consultant Clinical Oncologist",
	subtitle: "Translational AI Innovation Lead, UCLH",
	/** Short brand line used in footers and secondary placements. */
	brandLine:
		"Clinical oncology with a specialist team in data analysis and emerging technology, working toward more personalised cancer care.",
	gmc: "7140353",
	gmcVerifyUrl: "https://www.gmc-uk.org/registrants/7140353",
	headshot: "/karen_sayal_image-nobg.png",
};

export type NavLinkItem = {
	to: string;
	label: string;
};

export type NavItem =
	| NavLinkItem
	| {
			label: string;
			children: readonly NavLinkItem[];
	  };

export const nav: readonly NavItem[] = [
	{ to: "/about", label: "About" },
	{ to: "/conditions", label: "Conditions" },
	{ to: "/consultations", label: "Consultations" },
	{
		label: "Research Analytics Lab",
		children: [
			{
				to: "/research/pancreatic-reanalysis",
				label: "PDAC vaccine reanalysis",
			},
		],
	},
	{ to: "/conferences", label: "Conferences" },
	{ to: "/blog", label: "Blog" },
	{ to: "/faq", label: "FAQ" },
	{ to: "/contact", label: "Contact" },
];

export function isNavGroup(
	item: NavItem,
): item is Extract<NavItem, { children: readonly NavLinkItem[] }> {
	return "children" in item;
}

export const credentials = [
	{
		abbr: "MB BChir (Cantab)",
		detail: "Gonville and Caius College, University of Cambridge",
		href: "https://www.cam.ac.uk/",
		logo: "/organisation-logos/cambridge.svg",
		logoAlt: "University of Cambridge coat of arms",
	},
	{
		abbr: "MRCP",
		detail: "Member of the Royal College of Physicians",
		href: "https://www.rcp.ac.uk/",
		logo: "/organisation-logos/rcp.svg",
		logoAlt: "Royal College of Physicians",
	},
	{
		abbr: "FRCR",
		detail: "Fellow of the Royal College of Radiologists",
		href: "https://www.rcr.ac.uk/",
		logo: "/organisation-logos/rcr.svg",
		logoAlt: "Royal College of Radiologists",
	},
	{
		abbr: "DPhil (Oxon)",
		detail:
			"University of Oxford / Oxford CRUK Cancer Centre; CRUK Clinical Research Training Fellowship",
		href: "https://www.ox.ac.uk/",
		logo: "/organisation-logos/oxford.svg",
		logoAlt: "University of Oxford",
	},
	{
		abbr: "GMC",
		detail: `Registration No. ${site.gmc}`,
		href: site.gmcVerifyUrl,
		logo: "/organisation-logos/gmc.svg",
		logoAlt: "General Medical Council",
	},
] as const;

export const appointments = [
	{
		role: "Consultant Clinical Oncologist & Translational AI Innovation Lead | UCLH (current)",
	},
	{
		role: "Formerly: Senior Director, AI Industrialised Clinical Development | Recursion Pharmaceuticals",
	},
	{
		role: "Formerly: Postdoctoral Fellow | AI Division, GSK Pharmaceuticals",
	},
] as const;

/** Homepage section: clinical practice, analytics team, and direction of travel. */
export const homePlatform = {
	eyebrow: "How we work",
	title: "Clinic care with serious analytical depth",
	lede:
		"Patients see a consultant oncologist, supported by specialists in data analysis and new technology. Alongside appointments we publish open work on neoantigen vaccine science, and we keep building the foundations for what comes next in personalised care.",
	pillars: [
		{
			title: "Consultant care",
			text: "Thyroid cancer and haematological malignancies, with clear plans, multidisciplinary coordination, and clinics across central London.",
			to: "/consultations",
			linkLabel: "View consultations",
		},
		{
			title: "Analytics and technology",
			text: "A specialist team works with the clinic on data analysis and computational methods, including our Research Analytics Lab on published pancreatic mRNA neoantigen vaccine data.",
			to: "/research/pancreatic-reanalysis",
			linkLabel: "View the lab",
		},
		{
			title: "What we are building toward",
			text: "We are preparing clinical and software pathways for advanced diagnostics and personalised cancer vaccines, so the practice is ready as those options mature.",
			to: "/about",
			linkLabel: "About the approach",
		}
	],
} as const;

/** Inline prose: plain string chunks or linked labels. */
export type ProseLink = { readonly text: string; readonly href: string };
export type ProseChunk = string | ProseLink;
export type ProseParagraph = string | readonly ProseChunk[];

export function isProseLink(chunk: ProseChunk): chunk is ProseLink {
	return typeof chunk === "object" && "href" in chunk;
}

export const about = {
	heroTitle: "Personalised Cancer Care",
	heroLede:
		"A London consultant oncology practice for patients who want careful clinical care and a clear view of where personalised cancer treatment is heading. Led by Dr Karen Sayal, Consultant Clinical Oncologist in thyroid cancer and radiotherapy for haematological cancers, with a specialist team in data analysis and new technology. Tools help; clinical judgement still leads.",
	sections: [
		{
			heading: "Where she practises",
			paragraphs: [
				"Dr Sayal sees patients at HCA at University College Hospital, Leaders in Oncology Care (LOC), and The Harley Street Clinic, all part of HCA Healthcare. She holds an NHS Consultant post at University College London Hospitals NHS Foundation Trust (UCLH), where she is also Translational AI Innovation Lead, developing AI tools for personalised therapy and improving how care is delivered.",
			] satisfies readonly ProseParagraph[],
		},
		{
			heading: "Clinical training and research",
			paragraphs: [
				[
					"Dr Sayal read medicine at ",
					{ text: "Gonville and Caius College", href: "https://www.cai.cam.ac.uk/" },
					", ",
					{ text: "University of Cambridge", href: "https://www.cam.ac.uk/" },
					" (MB BChir Cantab) and trained as a clinician (MRCP) before specialising in Clinical Oncology, gaining her Fellowship of the ",
					{
						text: "Royal College of Radiologists",
						href: "https://www.rcr.ac.uk/",
					},
					" (FRCR). She was the first NIHR funded Academic Clinical Trainee in Clinical Oncology at the ",
					{ text: "University of Oxford", href: "https://www.ox.ac.uk/" },
					", and went on to complete a DPhil (Oxon) as a ",
					{
						text: "Cancer Research UK",
						href: "https://www.cancerresearchuk.org/",
					},
					" Clinical Research Training Fellow at the ",
					{
						text: "Oxford CRUK Cancer Centre",
						href: "https://crukcentre.cancer.ox.ac.uk/",
					},
					".",
				],
				[
					"Her doctoral research examined the tumour microenvironment in triple negative breast cancer using spatial transcriptomics and single cell sequencing, methods that show how individual cells in a tumour behave and respond to treatment, including a research collaboration with the ",
					{
						text: "Broad Institute of MIT and Harvard",
						href: "https://www.broadinstitute.org/",
					},
					".",
				],
			] satisfies readonly ProseParagraph[],
		},
		{
			heading: "From research to industry AI",
			paragraphs: [
				[
					"During her doctorate she taught herself the mathematics behind machine learning. After her DPhil she completed a postdoctoral fellowship in the AI division of ",
					{ text: "GSK Pharmaceuticals", href: "https://www.gsk.ai/" },
					", then became Senior Director in AI Industrialised Clinical Development at ",
					{ text: "Recursion Pharmaceuticals", href: "https://www.recursion.com/" },
					", where she led work using artificial intelligence to speed up clinical development and reduce its risk.",
				],
			] satisfies readonly ProseParagraph[],
		},
		{
			heading: "Bringing it together",
			paragraphs: [
				"She brings that background into clinic. At UCLH she helps develop and test new AI tools, so when she reviews scans, pathology and options she can judge what is genuinely ready to help, not only what is already routine. She continues to treat thyroid cancer and haematological cancers needing radiotherapy, with each plan built around the patient in front of her.",
				"She does not do the computational work alone. Personalised Cancer Care has a specialist team for data analysis, software and evaluating new techniques, so clinical decisions stay grounded in evidence.",
				"In short: consultations and treatment planning now, vaccine science analytics published openly, and careful preparation for advanced diagnostics and personalised cancer vaccines as those options become ready.",
			] satisfies readonly ProseParagraph[],
		},
	],
	belief:
		"Good technology should support clinical expertise, so every patient gets a plan that is accurate, timely and personal.",
	bottomCta:
		"New patient reviews, second opinions, and ongoing monitoring appointments are available across HCA at University College Hospital, Leaders in Oncology Care (LOC), and The Harley Street Clinic.",
};

export const conditionsPage = {
	title: "Understanding your diagnosis, and the care that follows",
	lede:
		"Clear, straightforward information about the conditions Dr Sayal treats: what they mean, how they are treated, and what you can expect at each step, from your first appointment onwards.",
	quote:
		"A cancer diagnosis brings a great deal of uncertainty. My aim is always to make sure you understand what is happening, what your options are, and why we are recommending a particular path, so that you feel informed and involved at every stage of your care.",
	quoteAttr: "Dr Karen Sayal, Consultant Clinical Oncologist",
	reassure: {
		strong: "Not sure where your diagnosis fits?",
		text: "You don't need to work it out alone. Get in touch and we will help you understand your options.",
	},
	trust: {
		title: "Care that is coordinated around you, not around a department",
		lede:
			"Cancer care rarely involves just one specialist. Dr Sayal works as part of a multidisciplinary team (MDT) alongside surgeons, haematologists and specialist nurses, so your case is reviewed from every angle and everyone involved in your care works from the same plan.",
		points: [
			{
				title: "One plan, not several opinions to reconcile",
				description:
					"Your specialists discuss your case together, so you're not left piecing together advice from different teams.",
			},
			{
				title: "You are kept in the loop",
				description:
					"Decisions are explained to you in plain language, with time for your questions, not simply handed down.",
			},
			{
				title: "Continuity throughout treatment",
				description:
					"The same team follows your case from diagnosis through to follow up care.",
			},
		],
	},
	callout: {
		title: "Recently diagnosed and not sure what happens next?",
		body:
			"You do not need a referral in hand to ask a question. Get in touch and we'll help you understand your options, at your own pace.",
	},
};

export const conditions = [
	{
		slug: "thyroid-cancer",
		title: "Thyroid Cancer",
		summary:
			"Expert diagnosis, treatment planning and ongoing care for patients with thyroid cancer.",
		body: "Dr Sayal provides expert diagnosis, treatment planning and ongoing care for patients with thyroid cancer, including differentiated (papillary and follicular), medullary and anaplastic subtypes. This includes staging, radioactive iodine therapy planning, external beam radiotherapy where indicated, and systemic treatment, delivered in close collaboration with endocrine surgeons and specialist nurses.",
		plain:
			"A cancer that develops in the thyroid gland at the front of your neck. Most thyroid cancers, particularly the papillary and follicular types, respond well to treatment, especially when caught and managed early.",
		howWeHelp: [
			"Diagnosis and staging across all thyroid cancer types, including papillary, follicular, medullary and anaplastic, so you understand exactly what you are facing.",
			"Radioactive iodine therapy, a treatment specific to thyroid cancer, planned around your individual case.",
			"External beam radiotherapy, where this is the right option for your situation.",
			"Systemic (medication based) treatment, when appropriate.",
			"Joined up care with your endocrine surgeon and specialist nurses, so nothing falls between the gaps.",
		],
		whatToExpect: [
			{
				title: "Your first consultation",
				text: "we will talk through your diagnosis, scans and pathology results in plain language, and answer your questions.",
			},
			{
				title: "A treatment plan built with you",
				text: "agreed together, not simply decided for you.",
			},
			{
				title: "Ongoing follow up",
				text: "regular reviews and support during and after treatment.",
			},
		],
		ctaLabel: "Talk to Dr Sayal about thyroid cancer",
	},
	{
		slug: "haematological-cancers",
		title: "Lymphoma, Leukaemia & Myeloma",
		summary:
			"Radiotherapy planning and delivery for lymphoma, leukaemia and myeloma.",
		body: "Dr Sayal offers radiotherapy planning and delivery for patients with haematological malignancies, including lymphoma, leukaemia and myeloma, working alongside haematologists as part of a multidisciplinary team to integrate radiotherapy with systemic treatment.",
		plain:
			"If you have been diagnosed with a blood cancer such as lymphoma, leukaemia or myeloma, radiotherapy may form part of your treatment plan, often alongside chemotherapy or other treatment led by your haematologist.",
		howWeHelp: [
			"Planning and delivering radiotherapy tailored to your specific diagnosis and stage.",
			"Working directly with your haematology team, so radiotherapy is integrated with your wider treatment rather than a separate, disconnected step.",
			"Explaining clearly what your radiotherapy involves, how long it takes, and what to expect during and after.",
		],
		whatToExpect: [
			{
				title: "Referral from your haematologist",
				text: "Dr Sayal joins your existing care team rather than starting from scratch.",
			},
			{
				title: "A planning appointment",
				text: "scans and measurements to target your treatment precisely.",
			},
			{
				title: "Treatment sessions",
				text: "typically short, outpatient appointments, with support throughout.",
			},
		],
		ctaLabel: "Ask about radiotherapy for blood cancers",
	},
] as const;

export const consultationsPage = {
	title: "Care built around you",
	lede:
		"Every patient arrives at a different stage. Whether you need a first plan, a second opinion or ongoing monitoring, the appointment should leave you with clear options and a written plan you can return to, shaped by specialist oncology and by our work in analytics, diagnostics and vaccine science.",
	reassure: "You will always understand what is being recommended, and why.",
	callout: {
		title: "Ready for the next step?",
		body:
			"Book a consultation when it suits you, or ask the clinic team about fees, insurance and what to expect before you come.",
	},
};

export const services = [
	{
		title: "New Patient Consultation",
		description:
			"A thorough review of your scans and pathology, an unhurried discussion of the options available to you, and a written treatment plan you can take away and reflect on.",
	},
	{
		title: "Second Opinion",
		description:
			"An independent review of your diagnosis and proposed treatment, helpful when you would simply like reassurance, or want to understand all of your options before deciding how to proceed.",
	},
	{
		title: "Personalised Treatment Planning",
		description:
			"Treatment is planned around your specific cancer, not a single fixed protocol applied to everyone. This may include diagnostics, radiotherapy, systemic (drug) therapy, or a combination of these. For example, thyroid cancer is often managed with systemic therapy as well as radiotherapy, depending on what is right for you.",
		tags: [
			{ label: "Diagnostics", variant: "teal" as const },
			{ label: "Radiotherapy", variant: "teal" as const },
			{ label: "Systemic therapy", variant: "teal" as const },
		],
	},
	{
		title: "Ongoing Treatment & Monitoring",
		description:
			"Regular review appointments during and after treatment, so you always know what to expect next and are never navigating your care alone.",
	},
	{
		title: "Virtual Consultations",
		description:
			"Video appointments for patients who prefer, or are unable, to attend in person, with the same care and attention, wherever you are joining from.",
	},
] as const;

export const faqPage = {
	title: "Answers to help you feel prepared",
	lede:
		"Here are some common questions patients ask before their first appointment and during their care. If you cannot find what you are looking for, please contact the clinic team directly.",
	callout: {
		title: "Still have a question?",
		body:
			"The clinic team is happy to help before you book. Arrange a consultation online, or ask about fees, insurance, and what to expect at your first visit.",
	},
	groups: [
		{
			title: "Before your visit",
			items: [
				{
					question: "Do I need a referral to book a consultation?",
					answer:
						"A referral from your general practitioner or another specialist is often helpful, but second opinion and private consultations can usually be arranged directly. The clinic team can advise on what is needed before your appointment.",
				},
				{
					question: "How soon can I be seen?",
					answer:
						"The clinic team will always try to arrange your appointment as soon as possible, especially for a new diagnosis. Exact timing depends on your circumstances and clinic availability, so please contact the clinic team directly to discuss this.",
				},
				{
					question: "What should I bring to my first appointment?",
					answer:
						"Please bring any referral letters, scans, or pathology reports you have, a list of your current medications, and your insurer details if you are using private medical insurance. If you are unsure what is needed, the clinic team can advise you in advance.",
				},
				{
					question: "Is private medical insurance accepted?",
					answer:
						"Yes. Dr Sayal accepts patients funded through private medical insurance as well as those paying for their own care. Insurance patients need an authorisation code from their insurer; the appointment is confirmed only after the clinic verifies that code. Self-pay fees are confirmed when you book.",
				},
			],
		},
		{
			title: "Your appointment",
			items: [
				{
					question: "What happens at a first consultation?",
					answer:
						"Your first appointment typically includes a review of your scans and pathology, an unhurried discussion of your diagnosis and options, and a clear written treatment plan so you know the recommended next steps.",
				},
				{
					question: "Can I bring a family member or friend with me?",
					answer:
						"Yes. Many patients find it helpful to have a family member, friend, or carer with them for support, and to help take in the information discussed during the appointment.",
				},
				{
					question: "What treatments does Dr Sayal offer?",
					answer:
						"Treatment is planned around your specific cancer rather than a single approach used for everyone. Depending on what is right for you, this may include diagnostics, radiotherapy, systemic (drug) therapy, or a combination of these. For example, thyroid cancer is often managed with systemic therapy as well as radiotherapy.",
					tags: [
						{ label: "Diagnostics", variant: "teal" as const },
						{ label: "Radiotherapy", variant: "teal" as const },
						{ label: "Systemic therapy", variant: "teal" as const },
					],
				},
			],
		},
		{
			title: "Conditions and ongoing care",
			items: [
				{
					question: "What conditions does Dr Sayal treat?",
					answer:
						"Dr Sayal specialises in thyroid cancer and haematological malignancies, including lymphoma, leukaemia, and myeloma. Each patient is treated with the combination of diagnostics, radiotherapy, and systemic therapy best suited to them, as part of a multidisciplinary team.",
				},
				{
					question: "Can I request a second opinion?",
					answer:
						"Yes. Second opinion consultations provide an independent review of your diagnosis and proposed treatment, which can help you feel confident about the pathway ahead.",
				},
				{
					question: "Who can I contact if I have concerns during treatment?",
					answer:
						"The clinic team is available to answer questions between appointments. If you have concerns about symptoms or side effects during treatment, please contact the clinic directly so you can be advised or seen promptly.",
				},
			],
		},
		{
			title: "Locations",
			items: [
				{
					question: "Where are clinics held?",
					answer:
						"Dr Sayal sees patients at HCA at University College Hospital, Leaders in Oncology Care (LOC), and The Harley Street Clinic, all part of HCA Healthcare. Virtual consultations are also available where appropriate.",
				},
				{
					question: "Are remote consultations offered?",
					answer:
						"Yes, remote consultations are available. Video appointments can be arranged where clinically appropriate, offering a convenient option for follow-ups or initial discussions when attending in person is not possible.",
				},
			],
		},
	],
} as const;

export const conferencesPage = {
	title: "Selected talks and engagements",
	lede:
		"Invited talks, conference presentations and advisory roles Dr Sayal has taken part in, across clinical oncology, translational AI and cancer care.",
	sectionEyebrow: "Conferences & Presentations",
} as const;

export type ConferenceTiming = "upcoming" | "past" | "ongoing";

export type ConferenceEntry = {
	readonly year: number;
	readonly timing: ConferenceTiming;
	readonly date: string;
	readonly location: string;
	readonly tag?: string;
	readonly title: string;
	readonly description: readonly RichTextSegment[];
};

export type RichTextSegment = {
	readonly text: string;
	readonly emphasis?: boolean;
};

export const conferenceEntries: readonly ConferenceEntry[] = [
	{
		year: 2027,
		timing: "upcoming",
		date: "17 to 21 Sep 2027",
		location: "Barcelona, Spain",
		tag: "Organising committee",
		title: "ESMO Congress 2027",
		description: [
			{
				text:
					"Serving on the organising committee for the ESMO Congress 2027, which will take place in Barcelona, Spain, from 17 to 21 September 2027.",
			},
		],
	},
	{
		year: 2027,
		timing: "upcoming",
		date: "17 to 22 Jan 2027",
		location: "Zurich, Switzerland",
		title: "Paul Scherrer Institute Winter School for Proton Therapy",
		description: [
			{
				text:
					"Will attend the PSI Winter School for Proton Therapy at the Paul Scherrer Institute in Zurich, Switzerland, from 17 to 22 January 2027, covering the clinical, physics and technological aspects of proton therapy.",
			},
		],
	},
	{
		year: 2026,
		timing: "upcoming",
		date: "16 to 18 Nov 2026",
		location: "Berlin, Germany",
		title: "ESMO AI & Digital Oncology Congress",
		description: [
			{
				text:
					"Will attend the ESMO AI and Digital Oncology Congress in Berlin, Germany, from 16 to 18 November 2026, focused on the clinical application of AI and digital tools across oncology.",
			},
		],
	},
	{
		year: 2026,
		timing: "past",
		date: "24 Oct 2026",
		location: "Madrid, Spain",
		tag: "Invited panel",
		title: "Women in Cancer, ESMO Congress 2026",
		description: [
			{
				text:
					"Took part in an invited panel discussion on the responsible use of AI in medicine, in conversation with Dr. Caroline Chung, the Chief Data Officer of MD Anderson Cancer Center, at the Women in Cancer event during the ESMO Congress 2026 in Madrid, Spain, on 24 October 2026.",
			},
		],
	},
	{
		year: 2026,
		timing: "past",
		date: "9 to 10 Oct 2026",
		location: "Riyadh, Saudi Arabia",
		tag: "Invited talks",
		title: "Society of Hematologic Oncology (SOHO)",
		description: [
			{ text: "Artificial Intelligence for Smarter Clinical Registries", emphasis: true },
			{ text: " and " },
			{
				text: "AI-Driven Solutions for Maximizing Registry Outcomes.",
				emphasis: true,
			},
			{
				text:
					" Presented an invited talk and panel discussion at the SOHO meeting in Riyadh, Saudi Arabia, from 9 to 10 October 2026.",
			},
		],
	},
	{
		year: 2026,
		timing: "ongoing",
		date: "Since Sep 2025",
		location: "Kings Cross, London",
		tag: "Ongoing",
		title: "Clinical Advisor, Encode “AI for Science Fellowship” (Pillar VC)",
		description: [
			{
				text:
					"Has been serving as Clinical Advisor to the Encode “AI for Science Fellowship,” a programme run by Pillar VC and backed by ARIA and DSIT, pairing leading AI researchers with major scientific and medical challenges, based at Kings Cross, London, since September 2025.",
			},
		],
	},
	{
		year: 2026,
		timing: "past",
		date: "9 to 10 Jun 2026",
		location: "Hilton Park Lane, London",
		title: "13th Annual Outsourcing in Clinical Trials UK & Ireland",
		description: [
			{
				text:
					"Attended the 13th Annual Outsourcing in Clinical Trials UK and Ireland conference at the Hilton Park Lane, London, from 9 to 10 June 2026.",
			},
		],
	},
	{
		year: 2026,
		timing: "past",
		date: "8 Jun 2026",
		location: "Olympia, London",
		title: "London Tech Week",
		description: [
			{
				text: "Attended London Tech Week at Olympia, London, on 8 June 2026.",
			},
		],
	},
	{
		year: 2026,
		timing: "past",
		date: "29 Apr 2026",
		location: "Palace of Westminster, London",
		title: "Unlocking the Future of UK Life Sciences",
		description: [
			{
				text:
					"Took part in the “Unlocking the Future of UK Life Sciences” parliamentary roundtable at the Palace of Westminster, London, on 29 April 2026, examining how the UK can accelerate the adoption of innovation, including AI and genomics, across the NHS.",
			},
		],
	},
	{
		year: 2026,
		timing: "past",
		date: "14 Apr 2026",
		location: "Palace of Westminster, London",
		title: "AI in Healthcare and Life Sciences Parliamentary Showcase",
		description: [
			{
				text:
					"Took part in the AI in Healthcare and Life Sciences Parliamentary Showcase at the Palace of Westminster, London, on 14 April 2026, an invitation only event bringing together parliamentarians, NHS leaders, policymakers and innovators to discuss the practical adoption of AI across the NHS and life sciences.",
			},
		],
	},
	{
		year: 2026,
		timing: "past",
		date: "24 Feb 2026",
		location: "London",
		title: "AI for Personalised Care & Clinical Trials Roundtable",
		description: [
			{
				text:
					"Took part in the AI for Personalised Care and Clinical Trials roundtable in London on 24 February 2026, hosted by Future.bio.",
			},
		],
	},
	{
		year: 2026,
		timing: "past",
		date: "28 to 29 Jan 2026",
		location: "Olympia, London",
		tag: "Invited talk",
		title: "Festival of Genomics & Biodata",
		description: [
			{
				text: "Use of Technology for Personalised Care and Clinical Trials.",
				emphasis: true,
			},
			{
				text:
					" Gave an invited talk at the Festival of Genomics and Biodata, Olympia, London, from 28 to 29 January 2026.",
			},
		],
	},
	{
		year: 2026,
		timing: "past",
		date: "27 Jan 2026",
		location: "London",
		title: "PharmaAI Leaders Exchange",
		description: [
			{
				text:
					"Attended the PharmaAI Leaders Exchange in London on 27 January 2026, an invitation only event organised by Frontline Genomics in preparation for the Festival of Genomics.",
			},
		],
	},
	{
		year: 2026,
		timing: "past",
		date: "12 to 15 Jan 2026",
		location: "San Francisco, USA",
		title: "JP Morgan Healthcare Conference Week",
		description: [
			{
				text:
					"Engaged with global healthcare leaders and innovators in San Francisco during JP Morgan Healthcare Conference week, from 12 to 15 January 2026, taking part in the industry meetings and gatherings held throughout one of the most closely watched weeks in the global healthcare calendar.",
			},
		],
	},
	{
		year: 2025,
		timing: "past",
		date: "17 Nov 2025",
		location: "Somerset House, London",
		title: "London Life Sciences Week: Opening Reception",
		description: [
			{
				text:
					"Attended the invitation only opening reception for London Life Sciences Week, hosted by the Mayor of London’s office, at Somerset House, London, on 17 November 2025.",
			},
		],
	},
	{
		year: 2025,
		timing: "past",
		date: "7 Nov 2025",
		location: "Royal College of Physicians, London",
		title: "UK Lymphoma Research Group Annual Meeting",
		description: [
			{
				text:
					"Attended the UK Lymphoma Research Group annual meeting at the Royal College of Physicians, London, on 7 November 2025, a full day review of clinical trials in lymphoma.",
			},
		],
	},
	{
		year: 2025,
		timing: "past",
		date: "7 to 8 Oct 2025",
		location: "Teddington, UK",
		tag: "Invited roundtable",
		title: "Bushy House Scientific Meeting: Getting the Measure of AI",
		description: [
			{
				text:
					"Was an invited participant in an invitation only roundtable convened by the National Physical Laboratory (NPL) at Teddington, UK, from 7 to 8 October 2025, bringing together experts from across the UK to inform an official NPL report on establishing trust and confidence in AI systems.",
			},
		],
	},
	{
		year: 2025,
		timing: "past",
		date: "30 Sep to 1 Oct 2025",
		location: "Royal College of Physicians, London",
		tag: "Invited talk",
		title: "Economist Impact: AI in Health Summit",
		description: [
			{
				text:
					"Gave an invited talk on the use of AI for personalised care and clinical trials at the AI in Health Summit, part of Economist Impact’s Future of Health Europe, at the Royal College of Physicians, London, from 30 September to 1 October 2025.",
			},
		],
	},
	{
		year: 2025,
		timing: "past",
		date: "May 2024 & 2025",
		location: "Chicago, USA",
		title: "American Society of Clinical Oncology (ASCO) Annual Meeting",
		description: [
			{
				text: "Attended the ASCO Annual Meeting in Chicago, USA, in May 2024 and again in May 2025.",
			},
		],
	},
] as const;

export const conferenceYearLabels: Record<number, string> = {
	2027: "Upcoming",
	2026: "Upcoming & past",
	2025: "Past",
};

export type BlogEntryKind = "post" | "article";

export type BlogArticleBlock =
	| { readonly type: "heading"; readonly text: string }
	| { readonly type: "paragraph"; readonly text: ProseParagraph }
	| {
			readonly type: "flow";
			readonly items: readonly string[];
			readonly caption?: string;
	  }
	| {
			readonly type: "steps";
			readonly items: readonly {
				readonly title: string;
				readonly body: string;
			}[];
			readonly caption?: string;
	  }
	| {
			readonly type: "compare";
			readonly items: readonly {
				readonly title: string;
				readonly purpose: string;
				readonly design: ProseParagraph;
			}[];
			readonly caption?: string;
	  }
	| {
			readonly type: "questions";
			readonly items: readonly string[];
	  }
	| {
			readonly type: "sources";
			readonly items: readonly {
				readonly text: string;
				readonly href: string;
			}[];
	  };

type BlogPostBase = {
	/** ISO date (YYYY-MM-DD), newest entries at the top of the list */
	readonly date: string;
};

export type BlogShortPost = BlogPostBase & {
	readonly kind?: "post";
	/** URL segment under /blog/ */
	readonly slug: string;
	/** Optional heading on the post page and listing */
	readonly title?: string;
	readonly paragraphs: readonly string[];
};

export type BlogArticle = BlogPostBase & {
	readonly kind: "article";
	/** URL segment under /article/ */
	readonly slug: string;
	readonly title: string;
	/** Short dek under the title */
	readonly lede: string;
	/** Series label, e.g. Patient guide */
	readonly series?: string;
	readonly blocks: readonly BlogArticleBlock[];
};

export type BlogPost = BlogShortPost | BlogArticle;

export function isBlogArticle(post: BlogPost): post is BlogArticle {
	return post.kind === "article";
}

export function articlePath(slug: string): string {
	return `/article/${slug}`;
}

export function blogPostPath(slug: string): string {
	return `/blog/${slug}`;
}

/**
 * Add new entries at the top of this list.
 * Posts: paragraphs only.
 * Articles: slug + structured blocks; linked from /blog to /article/:slug
 */
export const blogPosts: readonly BlogPost[] = [
	{
		date: "2026-11-07",
		kind: "article",
		slug: "what-are-personalised-cancer-vaccines",
		title: "What are personalised cancer vaccines?",
		lede: "How researchers use information from a person's tumour to design a vaccine for them.",
		blocks: [
			{
				type: "heading",
				text: "A vaccine made for one person",
			},
			{
				type: "paragraph",
				text: "A personalised cancer vaccine is a type of immunotherapy. Immunotherapy uses the immune system to help fight cancer. A personalised vaccine is designed around features of an individual's tumour, with the aim of helping their immune system recognise and attack cancer cells.",
			},
			{
				type: "paragraph",
				text: "Even two people with the same type of cancer can have tumours with different DNA changes. This means the targets selected for one person's vaccine may differ from those selected for another.",
			},
			{
				type: "heading",
				text: "What is a neoantigen?",
			},
			{
				type: "paragraph",
				text: "A change in a cancer cell's DNA can change one of the proteins the cell makes. The cell may display a tiny piece of that altered protein on its surface, like a label. An altered protein fragment that the immune system can recognise as new is called a neoantigen.",
			},
			{
				type: "flow",
				items: [
					"DNA changes: a tumour cell carries a change in its genetic instructions.",
					"Protein changes: the change can alter a protein the cell makes.",
					"A fragment is shown: the cell may display a tiny piece of that altered protein.",
				],
				caption: "How a tumour change can create an immune target",
			},
			{
				type: "heading",
				text: "Where this fits in cancer care",
			},
			{
				type: "paragraph",
				text: "Personalised neoantigen vaccines are being studied as a way to treat cancer or reduce the chance of it returning after treatment.",
			},
			{
				type: "heading",
				text: "From tumour sample to follow up",
			},
			{
				type: "paragraph",
				text: "A typical research pathway is shown below. The exact tests, vaccine and schedule depend on the study.",
			},
			{
				type: "steps",
				items: [
					{
						title: "Collect tumour tissue",
						body: "A biopsy or surgery provides tumour tissue. The team checks whether the sample is suitable for testing.",
					},
					{
						title: "Profile tumour DNA and RNA",
						body: "DNA tests look for changes in the tumour, often by comparing it with DNA from a blood sample. RNA tests can show which altered genetic instructions are being used.",
					},
					{
						title: "Shortlist possible neoantigens",
						body: "Computer programmes estimate which DNA changes could create pieces of protein that the person's immune system is likely to see. The predictions help researchers choose targets to study.",
					},
					{
						title: "Design and make the vaccine",
						body: "The team selects targets and makes an individual vaccine, for example using messenger RNA (mRNA) or short protein fragments. The batch undergoes quality checks.",
					},
					{
						title: "Give the vaccine and look for immune activity",
						body: "The vaccine aims to help immune cells show the selected fragments to T cells. Some T cells may then recognise cancer cells displaying the same fragments.",
					},
					{
						title: "Monitor safety and cancer outcomes",
						body: "The team checks for side effects and may use scans, blood tests and specialist assessments. Research tests may also look for a T cell response.",
					},
				],
				caption: "Six steps in a personalised cancer vaccine study",
			},
			{
				type: "heading",
				text: "How researchers choose the targets",
			},
			{
				type: "paragraph",
				text: "A DNA change can generate several possible targets. Researchers look for evidence that the tumour uses the altered instructions. They also consider a person's HLA type. HLA molecules act like holders that display protein fragments on cell surfaces, where T cells can inspect them.",
			},
			{
				type: "paragraph",
				text: "A computer programme can estimate how well a fragment might fit the person's HLA molecules. This helps narrow the list. An immune response in a laboratory test and an improvement in a patient's cancer are separate outcomes, which researchers assess in different ways.",
			},
			{
				type: "heading",
				text: "How the vaccine carries the message",
			},
			{
				type: "paragraph",
				text: "mRNA vaccines carry temporary instructions that some cells can use to make the selected fragments. Peptide vaccines deliver manufactured protein fragments. Researchers are also studying dendritic cell vaccines, which use immune cells prepared to present selected targets.",
			},
			{
				type: "paragraph",
				text: "The aim is to build up T cells that can spot cancer cells carrying the selected targets. A vaccine can include several targets, giving T cells more than one feature to look for. Researchers are also studying how long these immune responses last.",
			},
			{
				type: "heading",
				text: "Two uses of vaccination",
			},
			{
				type: "compare",
				items: [
					{
						title: "Routine preventive vaccine",
						purpose:
							"Reduce the risk of an infection or illness it can cause.",
						design: [
							"A standard formulation for eligible groups. The ",
							{
								text: "HPV vaccine",
								href: "https://www.nhs.uk/vaccinations/hpv-vaccine/",
							},
							" helps protect against infections that can cause several cancers.",
						],
					},
					{
						title: "Personalised cancer vaccine",
						purpose:
							"Help the immune system respond to cancer after diagnosis.",
						design:
							"A vaccine made using information from one person's tumour. Trials may test it after surgery or in people with active disease.",
					},
				],
				caption: "Preventive vaccination and personalised cancer vaccination",
			},
			{
				type: "heading",
				text: "Which cancers are being studied?",
			},
			{
				type: "paragraph",
				text: "Researchers are investigating personalised vaccines in melanoma, lung, bowel, pancreatic and kidney cancers, as well as other solid tumours. Some trials start after surgery and ask whether the vaccine can help reduce the chance of the cancer returning. Others study advanced disease, sometimes alongside established treatments such as checkpoint inhibitors, which help immune cells stay active against cancer.",
			},
			{
				type: "heading",
				text: "What have trials found so far?",
			},
			{
				type: "paragraph",
				text: [
					"Melanoma. In the phase 3 ",
					{
						text: "INTerpath-001",
						href: "https://www.esmo.org/insights-by-esmo/all-news/first-positive-phase-iii-trial-data-for-an-individualised-mrna-based-neoantigen-therapy",
					},
					" trial, adding the personalised mRNA vaccine intismeran autogene to pembrolizumab after surgery for high risk melanoma improved the length of time people lived without the cancer returning, compared with pembrolizumab alone. These results apply to the group and treatment combination studied.",
				],
			},
			{
				type: "paragraph",
				text: [
					"Pancreatic cancer. A small early stage ",
					{
						text: "study of a personalised mRNA vaccine",
						href: "https://www.nature.com/articles/s41586-023-06063-y",
					},
					" given as part of a combination regimen after surgery found a vaccine targeted T cell response in 8 of 16 people who received it. Larger controlled studies are needed to establish whether the vaccine improves cancer outcomes.",
				],
			},
			{
				type: "heading",
				text: "What are the practical limits?",
			},
			{
				type: "paragraph",
				text: "Some tissue samples yield too little usable material. Some tumours have few suitable targets, and cancer cells can find ways to escape immune detection. Designing, making and checking each vaccine takes time. Trial teams consider whether this fits with the timing of other treatment.",
			},
			{
				type: "paragraph",
				text: "Side effects vary with the vaccine and any treatments given alongside it. Examples can include a sore injection site, fatigue or fever. Checkpoint inhibitors can also cause immune related side effects. The study team explains the expected risks, how side effects are monitored and who to contact if symptoms develop.",
			},
			{
				type: "heading",
				text: "How teams follow up",
			},
			{
				type: "paragraph",
				text: "Scans and clinical reviews help assess the cancer. In some studies, blood tests look for circulating tumour DNA (ctDNA), which consists of tiny pieces of DNA shed by cancer cells.",
			},
			{
				type: "heading",
				text: "Can I access a personalised cancer vaccine?",
			},
			{
				type: "paragraph",
				text: [
					"Personalised neoantigen vaccines remain an emerging area of research. In England, the ",
					{
						text: "NHS Cancer Vaccine Launch Pad",
						href: "https://www.england.nhs.uk/cancer/nhs-cancer-vaccine-launch-pad/",
					},
					" helps people receiving NHS cancer care to be assessed for possible referral to participating vaccine and immunotherapy trials. Referral is a step towards assessment by the trial team. Each study has its own eligibility criteria and recruitment status.",
				],
			},
			{
				type: "paragraph",
				text: "Your oncology team can explain which trials may be relevant where you live in the UK. Eligibility can depend on the cancer type and stage, previous treatments, your general health and whether suitable tumour tissue is available. A trial may randomly assign participants to different treatment groups.",
			},
			{
				type: "heading",
				text: "Questions for your oncology team",
			},
			{
				type: "questions",
				items: [
					"Is there a trial relevant to my cancer type and stage?",
					"Could stored tissue be used, or would the study require a new biopsy?",
					"How would study visits and vaccine preparation fit with my current care?",
					"What are the possible side effects and how would they be monitored?",
				],
			},
			{
				type: "paragraph",
				text: "As studies mature, researchers are working out who is most likely to benefit, which targets to choose, and how best to combine vaccines with existing treatments.",
			},
			{
				type: "heading",
				text: "About this guide",
			},
			{
				type: "paragraph",
				text: "This article provides general information. Discuss trial participation and any changes to your treatment plan with your treating oncology team.",
			},
			{
				type: "sources",
				items: [
					{
						text: "NHS England. NHS Cancer Vaccine Launch Pad.",
						href: "https://www.england.nhs.uk/cancer/nhs-cancer-vaccine-launch-pad/",
					},
					{
						text: "ESMO Congress 2026. Phase 3 INTerpath-001 melanoma results.",
						href: "https://www.esmo.org/insights-by-esmo/all-news/first-positive-phase-iii-trial-data-for-an-individualised-mrna-based-neoantigen-therapy",
					},
					{
						text: "Rojas and colleagues, Nature (2023). Personalised RNA neoantigen vaccines in pancreatic cancer.",
						href: "https://www.nature.com/articles/s41586-023-06063-y",
					},
					{
						text: "NHS. HPV vaccine.",
						href: "https://www.nhs.uk/vaccinations/hpv-vaccine/",
					},
				],
			},
		],
	},
	{
		date: "2026-09-01",
		slug: "colorectal-vaccine-trial-more-than-cold-tumours",
		title: "A colorectal vaccine trial is about more than cold tumours",
		paragraphs: [
			"The BioNTech/Roche decision to terminate their colorectal cancer vaccine trial last week is being framed simply as evidence that “colorectal cancer is a cold tumour.”",
			"As an oncologist, I think the driving factors are more complicated.",
			"Cancer vaccine trials sit along at least three independent axes:",
			"1. Hot vs. cold tumour biology",
			"2. Monotherapy vs. combination therapy",
			"3. Metastatic vs. adjuvant setting",
			"This trial tested a particularly challenging combination: a cold tumour, treated with vaccine monotherapy, in the adjuvant setting. Contrast that with Merck and Moderna’s positive melanoma results just over a week earlier: a hot tumour, with the vaccine given in combination with Keytruda.",
			"This distinction is important. A negative result in colorectal cancer does not, by itself, tell us whether the limiting factor was tumour biology, the absence of checkpoint blockade, the clinical setting or some interaction between them.",
			"mRNA cancer vaccines trials can be designed to disentangle these variables.",
		],
	},
	{
		date: "2026-08-24",
		slug: "merck-moderna-phase-iii-and-delivery-infrastructure",
		title: "Positive Phase III data still need delivery infrastructure",
		paragraphs: [
			"Merck and Moderna’s recent positive Phase III readout marks an important step towards personalised cancer care. As a practising oncologist, it is encouraging to see this approach move closer to clinical practice.",
			"Beyond a supportive regulatory environment, a key constraint is the infrastructure needed to deliver such treatments at scale. Manufacturing and distributing personalised vaccines for tens of thousands of patients will require a significant evolution of the healthcare ecosystem.",
		],
	},
	{
		date: "2026-08-12",
		slug: "rare-tumours-and-personalised-vaccine-access",
		title: "Rare tumours and access to personalised vaccines",
		paragraphs: [
			"Recently a fellow oncologist asked my advice about a patient with anaplastic thyroid cancer, a rare and highly aggressive form of cancer. They were exploring whether a personalised mRNA vaccine could be developed for their patient.",
			"Only a handful of centres worldwide are currently capable of developing and administering such treatments. We need the clinical and manufacturing infrastructure, supported by appropriate ethical and regulatory frameworks, to ensure that patients with ultra-rare tumours have the opportunity to access them.",
		],
	},
];

export function getBlogArticleBySlug(slug: string): BlogArticle | undefined {
	return blogPosts.find(
		(post): post is BlogArticle => isBlogArticle(post) && post.slug === slug,
	);
}

export function getBlogArticles(): readonly BlogArticle[] {
	return blogPosts.filter(isBlogArticle);
}

export function getBlogShortPostBySlug(
	slug: string,
): BlogShortPost | undefined {
	return blogPosts.find(
		(post): post is BlogShortPost =>
			!isBlogArticle(post) && post.slug === slug,
	);
}

export function getBlogShortPosts(): readonly BlogShortPost[] {
	return blogPosts.filter(
		(post): post is BlogShortPost => !isBlogArticle(post),
	);
}

export const blog = {
	intro:
		"Short notes on oncology, translational AI and personalised cancer care, including diagnostics and vaccine treatments.",
} as const;

export const fees = {
	intro:
		"Dr Sayal accepts patients with private medical insurance and those who fund their own care. Self pay consultation fees below apply to UK patients and are payable when you book online.",
	insurers:
		"If you are using private medical insurance, you will need an authorisation code from your insurer before the appointment can be confirmed. The clinic checks the code, then bills your insurer.",
	international:
		"should contact the clinic team directly at",
	internationalAfter:
		"to discuss costs for private consultations and treatment options.",
	selfPay: [
		{ label: "New Patient Consultation", amount: "£350" },
		{ label: "Second Opinion", amount: "£350" },
		{ label: "Virtual Consultation", amount: "£350" },
		{ label: "Follow up / Monitoring", amount: "£250" },
	],
};

export const locations = [
	{
		name: "HCA UK at University College Hospital, part of HCA Healthcare UK",
		addressLines: [
			"5th Floor UCH Macmillan Cancer Centre",
			"Huntley Street",
			"London, WC1E 6AG",
		],
		mapsUrl: "https://maps.app.goo.gl/qu9RB1Smnry8AP2k9",
	},
	{
		name: "Leaders in Oncology Care",
		addressLines: ["95 Harley Street", "London, W1G 6AF"],
		mapsUrl: "https://maps.app.goo.gl/NBycteGA8KXvRmSJA",
	},
	{
		name: "HCA Healthcare UK The Harley Street Clinic",
		addressLines: ["35 Weymouth Street", "London, W1G 8BJ"],
		mapsUrl: "https://maps.app.goo.gl/WahfeHGru3YVqmW3A",
	},
] as const;

export const contactPage = {
	callout: {
		title: "Need to reach the clinical team?",
		body:
			"For questions about fees, insurance, clinic locations, or what to expect before your first visit, email the clinical team. Enquiries by email only.",
		emailLabel: "Email the clinical team",
		bookLabel: "Book a consultation",
	},
} as const;

export const contact = {
	secretaryLabel: "Secretary",
	email: "info@personalisedcancercare.com",
	enquiriesNote: "Enquiries by email only",
};

export const booking = {
	intro:
		"Booking an appointment with Dr Sayal is simple. Choose an available time below via our secure form.",
	note: "Times shown are free on the clinic calendar. Choose self pay to pay securely online when you book, or private insurance, where the clinic bills your insurer directly.",
};

export const privacyNotice = {
	title: "Patient Privacy Notice",
	lede:
		"This notice explains how Personalised Cancer Care Ltd handles personal information in connection with private oncology consultations and related care.",
	lastUpdated: "31 October 2026",
	company: {
		legalName: "Personalised Cancer Care Ltd",
		companyNumber: "17430677",
		registeredOffice: "3 Foley Street, London W1W 6DN",
	},
	formBlurbBefore:
		"Your privacy: Personalised Cancer Care Ltd uses the information you provide to respond to your enquiry and, where appropriate, arrange your care. Please read our",
	formBlurbAfter: "to understand how we handle your information.",
	emailSentenceBefore:
		"You can read how Personalised Cancer Care Ltd handles your personal information in our",
	emailSentenceAfter: ".",
	path: "/patient-privacy-notice",
	sections: [
		{
			heading: "1. Who we are",
			paragraphs: [
				"Personalised Cancer Care Ltd (“PCC”, “we”, “us” or “our”) provides private oncology services.",
				"PCC maintains records relating to enquiries, appointments, correspondence, administration and clinical care where PCC is responsible for those records. Where consultations or treatment take place through another healthcare organisation, such as HCA Healthcare UK, that organisation may maintain the primary clinical record in its own systems. PCC does not routinely duplicate those records.",
				"PCC is responsible for personal information that it processes as an independent data controller. Other healthcare organisations involved in your care, including hospitals, may act as separate data controllers for the information they hold.",
			],
		},
		{
			heading: "2. What information we collect",
			paragraphs: [
				"Depending on your circumstances, we may collect and use:",
			],
			bullets: [
				"Your name, date of birth and contact details.",
				"Appointment details and correspondence.",
				"A limited administrative contact record (name, postal address, email and telephone) where staff maintain your details in clinic tools.",
				"Medical history, diagnoses, treatment plans, test results and other relevant clinical information.",
				"Information received from or shared with healthcare professionals involved in your care.",
				"Insurance, invoicing and payment information.",
				"Information you provide when contacting us through our website, email or telephone.",
				"Records of administrative SMS messages sent to you through clinic tools, where applicable.",
			],
			closing: [
				"Health information is particularly sensitive and receives additional protection under data protection law.",
			],
		},
		{
			heading: "3. Why we use your information",
			paragraphs: [
				"We use personal information where necessary to:",
			],
			bullets: [
				"Respond to enquiries and arrange appointments.",
				"Assess your clinical needs and provide oncology consultations and related care.",
				"Maintain appropriate clinical records.",
				"Communicate with hospitals, GPs and other healthcare professionals involved in your care.",
				"Arrange clinically appropriate investigations or referrals.",
				"Issue invoices, liaise with insurers and administer payments.",
				"Send administrative SMS messages where appropriate (for example appointment related notices).",
				"Meet applicable professional, legal and regulatory obligations.",
				"Maintain the security and effective operation of our services.",
			],
			closing: [
				"We do not rely on your agreement to this privacy notice as consent for all these activities.",
			],
		},
		{
			heading: "4. Our lawful bases for processing",
			paragraphs: [
				"Under UK GDPR, we must have a lawful basis for using your personal information. Health information also requires an additional condition because it is special category data.",
				"In outline, we typically rely on the following Article 6 bases depending on the purpose:",
			],
			bullets: [
				"Contract: arranging and providing consultations and related services you have requested.",
				"Legal obligation: retaining or disclosing information where required by applicable law or regulation.",
				"Legitimate interests: proportionate administration, security and related operational activities, balanced against your rights.",
				"Consent: only where a particular activity genuinely requires consent.",
			],
			closing: [
				"For health information, we also rely on the Article 9 UK GDPR healthcare condition: processing necessary for medical diagnosis, the provision of healthcare or treatment, or management of healthcare services, subject to applicable professional confidentiality safeguards.",
				"Other lawful bases or conditions may apply in specific circumstances. The bases described above will be kept aligned with PCC’s approved lawful bases assessment.",
			],
		},
		{
			heading: "5. Who we share information with",
			paragraphs: [
				"Where appropriate and lawful, we may share relevant information with:",
			],
			bullets: [
				"Hospitals and healthcare organisations involved in your care, including HCA Healthcare UK and, where applicable, UCLH.",
				"Your GP, referring clinician and other treating healthcare professionals.",
				"Diagnostic laboratories and specialist testing providers, where investigations are arranged.",
				"Health insurers and payment administrators, where necessary for authorisation, invoicing or payment.",
				"Professional advisers, regulators or public authorities where disclosure is legally required or otherwise justified.",
				"Technology and administrative service providers acting on our behalf.",
			],
			closing: [
				"We limit disclosures to information relevant to the purpose.",
				"Hospitals and laboratories may have their own privacy notices and may act as independent data controllers.",
			],
		},
		{
			heading: "6. How we store and protect your information",
			paragraphs: [
				"PCC uses Google Workspace, including Gmail, Calendar and Drive, for aspects of patient correspondence, scheduling, administration and record-keeping.",
				"The website is hosted on Cloudflare infrastructure. Online self pay payments are processed by Stripe. Appointment booking uses Google Calendar. Authorised clinic staff may maintain a limited patient contact directory (name, postal address, email and telephone) in a Cloudflare D1 database used only for clinic administration.",
				"Where staff send administrative SMS messages through the clinic tools, message delivery is processed by Twilio. Message content and delivery metadata may be retained in the clinic systems as an audit record.",
				"Google, Cloudflare, Stripe and Twilio provide services to PCC under their respective contractual terms. We use account authentication, access controls and other appropriate security measures to protect information.",
				"Access to patient information is restricted according to professional and administrative responsibilities.",
				"No electronic system can be guaranteed completely secure, but we take reasonable steps to protect information against unauthorised access, loss and misuse.",
			],
		},
		{
			heading: "6.1 Website, cookies and Research Analytics Lab",
			paragraphs: [
				"Website enquiries are by email only. The Contact page displays an email address and does not submit a web form to Cloudflare or another form processor.",
				"The website may set strictly necessary cookies for site access control and for authorised clinic-staff tools. These cookies are functional and are not used for advertising.",
				"PCC does not use Google Analytics, Meta Pixel or similar marketing trackers on the website. If that position changes, this notice will be updated and any required consent arrangements put in place.",
				"The Research Analytics Lab pages present aggregates derived from published, de identified clinical trial supplemental tables (including Cell 2025 NeoVaxMI melanoma Data S1 to S5; NCT03929029, and Nature 2025 pancreatic mRNA neoantigen vaccine source data). They do not upload Personalised Cancer Care patient records and do not send identifiable patient information to external analytics or AI services.",
				"When you book online, the information you enter is used to arrange the appointment. Self-pay checkout is handled by Stripe; free-text appointment notes are not sent to Stripe. Calendar invitations and clinic correspondence are handled through Google Workspace.",
			],
		},
		{
			heading: "7. International transfers",
			paragraphs: [
				"Some technology providers, including Google, Cloudflare, Stripe and Twilio, may process information outside the United Kingdom.",
				"Where personal information is transferred to a country without applicable UK adequacy protection, we rely on appropriate safeguards where required, such as contractual transfer mechanisms recognised under UK data protection law.",
				"Google's contractual framework includes the UK International Data Transfer Addendum to the EU Standard Contractual Clauses. Cloudflare, Stripe and Twilio publish their own UK GDPR / international transfer documentation; PCC relies on the contractual arrangements applicable to its accounts.",
				"You may contact us for further information about the safeguards relevant to your information.",
			],
		},
		{
			heading: "8. How long we keep information",
			paragraphs: [
				"We retain personal information for periods appropriate to its purpose and in accordance with applicable legal, professional and regulatory requirements.",
				"Cancer and oncology clinical records: PCC generally retains oncology records for 30 years from diagnosis, or 8 years after death, in accordance with relevant healthcare records management guidance. This includes consultation notes, second opinions, diagnoses, treatment plans, prescribing records, investigation results, referrals and clinically relevant correspondence forming part of the oncology record.",
				"Other adult clinical records: We apply the retention period appropriate to the relevant record category. The general adult health record retention benchmark is 8 years.",
				"Administrative and financial records: Enquiries, appointment information, administrative correspondence, invoices, SMS audit records and financial records are retained for periods appropriate to their purpose and applicable legal, tax and accounting obligations.",
				"Records held by other healthcare organisations: Where another healthcare organisation, such as HCA Healthcare UK, maintains the primary clinical record, that organisation is responsible for retaining its own records under its applicable policies.",
				"At the end of the applicable retention period, PCC reviews whether continued retention is necessary for clinical, legal or regulatory reasons before securely deleting or otherwise disposing of the information.",
			],
		},
		{
			heading: "9. Your data protection rights",
			paragraphs: [
				"Depending on the circumstances, you may have the right to:",
			],
			bullets: [
				"Request access to your personal information.",
				"Ask us to correct inaccurate information.",
				"Request erasure of information where applicable.",
				"Request restriction of processing.",
				"Object to certain processing.",
				"Request data portability where applicable.",
				"Withdraw consent where processing is based on consent.",
			],
			closing: [
				"These rights are not absolute. For example, we may need to retain clinical records to meet professional or legal obligations.",
				"To exercise your rights, contact us using the details above.",
				"We will respond in accordance with applicable data protection law.",
			],
		},
		{
			heading: "10. Where information comes from",
			paragraphs: [
				"We may receive information directly from you or, where appropriate, from your GP, referring clinician, hospital, insurer or another healthcare professional involved in your care.",
				"Where required, we will provide additional information about the source and use of personal data obtained indirectly.",
			],
		},
		{
			heading: "11. Specialist diagnostic testing",
			paragraphs: [
				"Where clinically appropriate, PCC may arrange investigations through external diagnostic laboratories.",
				"This can involve sharing relevant clinical information and, where applicable, biological samples with the laboratory.",
				"We will provide additional information where necessary about the particular test, the laboratory's responsibilities and any associated data processing.",
			],
		},
		{
			heading: "12. Research and other secondary uses",
			paragraphs: [
				"Information collected for your care is not automatically authorised for unrelated research or commercial use.",
				"PCC will not begin a new secondary use of identifiable patient information without first establishing the necessary legal basis, confidentiality permissions, safeguards and transparency arrangements.",
				"Where a proposed activity requires additional information or consent, this will be addressed separately.",
			],
		},
		{
			heading: "13. Complaints",
			paragraphs: [
				"If you have concerns about how PCC handles your personal information, please contact us first so that we can investigate.",
				"You also have the right to complain to the Information Commissioner's Office (ICO).",
				"ICO website: https://ico.org.uk/make-a-complaint/",
				"ICO telephone: 0303 123 1113",
			],
		},
		{
			heading: "14. Changes to this notice",
			paragraphs: [
				"We may update this notice when our services, systems or legal obligations change.",
				"The latest version will be available on our website, with the date of the most recent update shown above.",
			],
		},
	],
} as const;
