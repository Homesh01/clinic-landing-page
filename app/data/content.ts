export const site = {
	name: "Dr Karen Sayal",
	title: "Consultant Clinical Oncologist",
	tagline:
		"Personalised cancer care for thyroid malignancies and radiotherapy for haematological cancers — informed by clinical expertise and translational AI.",
	gmc: "7140353",
	gmcVerifyUrl: "https://www.gmc-uk.org/registrants/7140353",
	headshot: "/karen_sayal_image-nobg.png",
};

export const nav = [
	{ to: "/", label: "Home" },
	{ to: "/about", label: "About" },
	{ to: "/conditions", label: "Conditions" },
	{ to: "/consultations", label: "Consultations" },
	{ to: "/conferences", label: "Conferences" },
	{ to: "/blog", label: "Blog" },
	{ to: "/faq", label: "FAQ" },
	{ to: "/contact", label: "Contact" },
] as const;

export const credentials = [
	{
		abbr: "MB BChir (Cantab)",
		detail: "Gonville and Caius College, University of Cambridge",
	},
	{
		abbr: "MRCP",
		detail: "Member of the Royal College of Physicians",
	},
	{
		abbr: "FRCR",
		detail: "Fellow of the Royal College of Radiologists",
	},
	{
		abbr: "DPhil (Oxon)",
		detail:
			"University of Oxford / Oxford CRUK Cancer Centre; CRUK Clinical Research Training Fellowship",
	},
	{
		abbr: "GMC",
		detail: `Registration No. ${site.gmc}`,
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

export const about = {
	heroTitle: "A clinician at the intersection of oncology and AI",
	heroLede:
		"Dr Karen Sayal is a Consultant Clinical Oncologist specialising in thyroid cancer and radiotherapy for haematological cancers. She combines specialist clinical training with a research and industry background in artificial intelligence, experience she draws on to help design treatment plans that are precise, well informed, and built around each patient.",
	sections: [
		{
			heading: "Where she practises",
			paragraphs: [
				"Dr Sayal sees patients at University College Hospital Private Care, Leaders in Oncology Care (LOC), and The Harley Street Clinic (all part of HCA Healthcare). She holds an NHS Consultant post at University College London Hospitals NHS Foundation Trust (UCLH), where she is also Translational AI Innovation Lead, leading the development of AI-driven tools for personalised therapy, streamlined care delivery, and expanding the range of treatments available to patients.",
			],
		},
		{
			heading: "Clinical training & research",
			paragraphs: [
				"Dr Sayal read medicine at Gonville and Caius College, University of Cambridge (MB BChir Cantab) and trained as a clinician (MRCP) before specialising in Clinical Oncology, gaining her Fellowship of the Royal College of Radiologists (FRCR). She was the first NIHR-funded Academic Clinical Trainee in Clinical Oncology at the University of Oxford, and went on to complete a DPhil (Oxon) as a Cancer Research UK Clinical Research Training Fellow at the Oxford CRUK Cancer Centre.",
				"Her doctoral research examined the tumour microenvironment in triple negative breast cancer using spatial transcriptomics and single cell sequencing, techniques that map how individual cells within a tumour behave, and how they respond to treatment, including a research collaboration with the Broad Institute of MIT and Harvard.",
			],
		},
		{
			heading: "From research to industry AI",
			paragraphs: [
				"It was during her doctoral research that Dr Sayal taught herself linear algebra and statistical inference, the mathematical foundations of machine learning, a decision that shaped the next stage of her career. After her DPhil, she completed a postdoctoral fellowship in the AI division of GSK Pharmaceuticals, before being appointed Senior Director in AI Industrialised Clinical Development at Recursion Pharmaceuticals, a leading AI driven drug discovery company, where she led work applying artificial intelligence to accelerate clinical development and reduce its risk at scale.",
			],
		},
		{
			heading: "Bringing it together",
			paragraphs: [
				"Dr Sayal brings that experience directly into the care of her own patients. Because she is personally involved in developing and testing new AI driven technologies at UCLH, she can draw on firsthand knowledge of which emerging tools and treatments are genuinely ready to help, not simply what is already established practice, when she reviews a patient's scans, pathology and options. She continues to see and treat patients with thyroid cancer and haematological malignancies requiring radiotherapy throughout, with every treatment plan still built around the individual in front of her.",
			],
		},
	],
	belief:
		"Technology and clinical expertise should work together to give every patient a treatment plan that is accurate, timely, and genuinely personal to them.",
	bottomCta:
		"New patient reviews, second opinions, and ongoing monitoring appointments are available across University College Hospital Private Care, Leaders in Oncology Care (LOC), and The Harley Street Clinic.",
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
					"The same team follows your case from diagnosis through to follow-up care.",
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
		icon: "thyroid" as const,
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
			"Systemic (medication-based) treatment, when appropriate.",
			"Joined-up care with your endocrine surgeon and specialist nurses, so nothing falls between the gaps.",
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
		icon: "blood" as const,
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
		"Every patient's path is different. Whatever stage you are at, whether a new diagnosis, a second opinion, or ongoing monitoring, each appointment is designed to give you clarity, a clear range of treatment options, and a written plan you can return to.",
	reassure: "You will always understand what is being recommended, and why.",
	callout: {
		title: "Ready to take the next step?",
		body:
			"Book a consultation at a time that suits you, or speak with the clinic team about fees, insurance, and what to expect before your first visit.",
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
						"Dr Sayal sees patients at University College Hospital Private Care, Leaders in Oncology Care (LOC), and The Harley Street Clinic, all part of HCA Healthcare. Virtual consultations are also available where appropriate.",
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
		"A record of invited talks, conference presentations, and advisory roles spanning clinical oncology, translational AI, and developments in cancer care.",
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
		timing: "upcoming",
		date: "24 Oct 2026",
		location: "Madrid, Spain",
		tag: "Invited panel",
		title: "Women in Cancer, ESMO Congress 2026",
		description: [
			{
				text:
					"Will take part in an invited panel discussion on the responsible use of AI in medicine, in conversation with Dr. Caroline Chung, the Chief Data Officer of MD Anderson Cancer Center, at the Women in Cancer event during the ESMO Congress 2026 in Madrid, Spain, on 24 October 2026.",
			},
		],
	},
	{
		year: 2026,
		timing: "upcoming",
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
					" Will present an invited talk and panel discussion at the SOHO meeting in Riyadh, Saudi Arabia, from 9 to 10 October 2026.",
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

export type BlogPost = {
	/** ISO date (YYYY-MM-DD) — newest posts should be added at the top of the list */
	readonly date: string;
	/** Body paragraphs. */
	readonly paragraphs: readonly string[];
};

/**
 * Add new posts at the top of this list.
 * date: YYYY-MM-DD
 * paragraphs: one string per paragraph
 */
export const blogPosts: readonly BlogPost[] = [
	{
		date: "2026-09-01",
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
		paragraphs: [
			"Merck and Moderna’s recent positive Phase III readout marks an important step towards personalised cancer care. As a practising oncologist, it is encouraging to see this approach move closer to clinical practice.",
			"Beyond a supportive regulatory environment, a key constraint is the infrastructure needed to deliver such treatments at scale. Manufacturing and distributing personalised vaccines for tens of thousands of patients will require a significant evolution of the healthcare ecosystem.",
		],
	},
	{
		date: "2026-08-12",
		paragraphs: [
			"Recently a fellow oncologist asked my advice about a patient with anaplastic thyroid cancer, a rare and highly aggressive form of cancer. They were exploring whether a personalised mRNA vaccine could be developed for their patient.",
			"Only a handful of centres worldwide are currently capable of developing and administering such treatments. We need the clinical and manufacturing infrastructure, supported by appropriate ethical and regulatory frameworks, to ensure that patients with ultra-rare tumours have the opportunity to access them.",
		],
	},
];

export const blog = {
	intro:
		"Selected commentary and posts from Dr Sayal on oncology, translational AI, and developments in cancer care.",
} as const;

export const fees = {
	intro:
		"Dr Sayal accepts patients funded through private medical insurance as well as self-funding patients. Self-pay consultation fees are payable when you book online.",
	insurers:
		"If you are using private medical insurance, you will need an authorisation code from your insurer before the appointment can be confirmed. The clinic checks the code, then bills your insurer.",
	selfPay: [
		{ label: "New Patient Consultation", amount: "£350" },
		{ label: "Second Opinion", amount: "£350" },
		{ label: "Virtual Consultation", amount: "£350" },
		{ label: "Follow-up / Monitoring", amount: "£250" },
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
		name: "LOC — Leaders in Oncology Care",
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
		title: "Need to reach the clinic team?",
		body:
			"For questions about fees, insurance, clinic locations, or what to expect before your first visit, email the clinic team. Enquiries by email only.",
		emailLabel: "Email the clinic team",
		bookLabel: "Book a consultation",
	},
} as const;

export const contact = {
	secretaryLabel: "Secretary / PA",
	email: "info@personalisedcancercare.com",
	enquiriesNote: "Enquiries by email only",
};

export const booking = {
	intro:
		"Booking an appointment with Dr Sayal is simple — choose an available time below, or contact the secretary directly.",
	note: "Times shown are free on the clinic calendar. Choose self-pay to pay securely online when you book, or private insurance, where the clinic bills your insurer directly.",
	fees: {
		standard: "£350",
		followUp: "£250",
	},
};
