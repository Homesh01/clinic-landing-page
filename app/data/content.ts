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
		role: "Consultant Clinical Oncologist & Translational AI Innovation Lead — UCLH",
		current: true,
	},
	{
		role: "Formerly: Senior Director, AI Industrialised Clinical Development — Recursion Pharmaceuticals",
	},
	{
		role: "Formerly: Postdoctoral Fellow, AI Division — GSK Pharmaceuticals",
	},
] as const;

export const about = {
	heroTitle: "A clinician at the intersection of oncology and AI",
	heroLede:
		"Dr Karen Sayal is a Consultant Clinical Oncologist specialising in thyroid cancer and radiotherapy for haematological cancers. She combines specialist clinical training with a research and industry background in artificial intelligence — experience she draws on to help design treatment plans that are precise, well-informed, and built around each patient.",
	sections: [
		{
			heading: "Where she practises",
			paragraphs: [
				"Dr Sayal sees patients at UCLH (HCA Healthcare), The London Oncology Clinic (HCA Healthcare), and on Harley Street. She holds an NHS Consultant post at University College London Hospitals NHS Foundation Trust (UCLH), where she is also Translational AI Innovation Lead, leading the development of AI-driven tools for personalised therapy, streamlined care delivery, and expanding the range of treatments available to patients.",
			],
		},
		{
			heading: "Clinical training & research",
			paragraphs: [
				"Dr Sayal read medicine at Gonville and Caius College, University of Cambridge (MB BChir Cantab) and trained as a clinician (MRCP) before specialising in Clinical Oncology, gaining her Fellowship of the Royal College of Radiologists (FRCR). She was the first NIHR-funded Academic Clinical Trainee in Clinical Oncology at the University of Oxford, and went on to complete a DPhil (Oxon) as a Cancer Research UK Clinical Research Training Fellow at the Oxford CRUK Cancer Centre.",
				"Her doctoral research examined the tumour microenvironment in triple-negative breast cancer using spatial transcriptomics and single-cell sequencing — techniques that map how individual cells within a tumour behave, and how they respond to treatment — including a research collaboration with the Broad Institute of MIT and Harvard.",
			],
		},
		{
			heading: "From research to industry AI",
			paragraphs: [
				"It was during her doctoral research that Dr Sayal taught herself linear algebra and statistical inference — the mathematical foundations of machine learning — a decision that shaped the next stage of her career. After her DPhil, she completed a postdoctoral fellowship in the AI division of GSK Pharmaceuticals, before being appointed Senior Director in AI Industrialised Clinical Development at Recursion Pharmaceuticals, a leading AI-driven drug discovery company, where she led work applying artificial intelligence to accelerate and de-risk clinical development at scale.",
			],
		},
		{
			heading: "Bringing it together",
			paragraphs: [
				"Dr Sayal brings that experience directly into the care of her own patients. Because she is personally involved in developing and testing new AI-driven technologies at UCLH, she can draw on first-hand knowledge of which emerging tools and treatments are genuinely ready to help — not simply what is already established practice — when she reviews a patient's scans, pathology and options. She continues to see and treat patients with thyroid cancer and haematological malignancies requiring radiotherapy throughout, with every treatment plan still built around the individual in front of her.",
			],
		},
	],
	belief:
		"Technology and clinical expertise should work together to give every patient a treatment plan that is accurate, timely, and genuinely personal to them.",
	bottomCta:
		"New patient reviews, second opinions, and ongoing monitoring appointments are available across UCLH, The London Oncology Clinic, and Harley Street.",
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
		title: "Care that's coordinated around you, not around a department",
		lede:
			"Cancer care rarely involves just one specialist. Dr Sayal works as part of a multidisciplinary team (MDT) alongside surgeons, haematologists and specialist nurses, so your case is reviewed from every angle and everyone involved in your care works from the same plan.",
		points: [
			{
				title: "One plan, not several opinions to reconcile",
				description:
					"Your specialists discuss your case together, so you're not left piecing together advice from different teams.",
			},
			{
				title: "You're kept in the loop",
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
			"You don't need a referral in hand to ask a question. Get in touch and we'll help you understand your options, at your own pace.",
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
			"Book a consultation at a time that suits you, or speak with the practice team about fees, insurance, and what to expect before your first visit.",
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
			{ label: "Diagnostics", variant: "green" as const },
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
		"Here are some common questions patients ask before their first appointment and during their care. If you cannot find what you are looking for, please contact the practice team directly.",
	callout: {
		title: "Still have a question?",
		body:
			"The practice team is happy to help before you book. Arrange a consultation online, or ask about fees, insurance, and what to expect at your first visit.",
	},
	groups: [
		{
			title: "Before your visit",
			items: [
				{
					question: "Do I need a referral to book a consultation?",
					answer:
						"A referral from your general practitioner or another specialist is often helpful, but second opinion and private consultations can usually be arranged directly. The practice team can advise on what is needed before your appointment.",
				},
				{
					question: "How soon can I be seen?",
					answer:
						"The practice team will always try to arrange your appointment as soon as possible, especially for a new diagnosis. Exact timing depends on your circumstances and clinic availability, so please contact the practice team directly to discuss this.",
				},
				{
					question: "What should I bring to my first appointment?",
					answer:
						"Please bring any referral letters, scans, or pathology reports you have, a list of your current medications, and your insurer details if you are using private medical insurance. If you are unsure what is needed, the practice team can advise you in advance.",
				},
				{
					question: "Is private medical insurance accepted?",
					answer:
						"Yes. Dr Sayal accepts patients funded through private medical insurance as well as those paying for their own care. Fees and insurer details are confirmed before your first appointment.",
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
						{ label: "Diagnostics", variant: "green" as const },
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
						"The practice team is available to answer questions between appointments. If you have concerns about symptoms or side effects during treatment, please contact the practice directly so you can be advised or seen promptly.",
				},
			],
		},
		{
			title: "Locations",
			items: [
				{
					question: "Where are clinics held?",
					answer:
						"Dr Sayal sees patients at University College London Hospitals, The London Oncology Clinic, and on Harley Street, all part of HCA Healthcare. Virtual consultations are also available where appropriate.",
				},
			],
		},
	],
} as const;

export const conferences = [
	{
		title: "Conference presentation — placeholder",
		detail:
			"Title, meeting name, location and date to be confirmed.",
	},
	{
		title: "Conference presentation — placeholder",
		detail:
			"Title, meeting name, location and date to be confirmed.",
	},
	{
		title: "Conference presentation — placeholder",
		detail:
			"Title, meeting name, location and date to be confirmed.",
	},
] as const;

export const publications = [
	{
		title: "Publication — placeholder",
		detail: "Citation details to be confirmed.",
	},
	{
		title: "Publication — placeholder",
		detail: "Citation details to be confirmed.",
	},
	{
		title: "Publication — placeholder",
		detail: "Citation details to be confirmed.",
	},
] as const;

export const blog = {
	intro:
		"Selected commentary and posts from Dr Sayal on oncology, translational AI, and developments in cancer care.",
	social: [
		{
			platform: "LinkedIn",
			label: "Follow on LinkedIn",
			url: "https://www.linkedin.com/",
			description:
				"Professional updates, conference reflections, and perspectives on oncology and AI in medicine.",
		},
		{
			platform: "X",
			label: "Follow on X",
			url: "https://x.com/",
			description:
				"Shorter posts and links to talks, publications, and clinical innovation.",
		},
	],
	note: "Profile URLs to be confirmed — replace the placeholder links when ready.",
} as const;

export const fees = {
	intro:
		"Dr Sayal accepts patients funded through private medical insurance as well as self-funding patients. Fees are discussed and confirmed prior to your first appointment.",
	insurers: "Insurers accepted — to be confirmed.",
	selfPay: "Self-pay indicative fee — to be confirmed.",
};

export const locations = [
	{
		name: "UCLH (HCA Healthcare)",
		address: "Exact address to be confirmed.",
	},
	{
		name: "The London Oncology Clinic (LOC), HCA Healthcare",
		address: "Exact address to be confirmed.",
	},
	{
		name: "Harley Street",
		address: "Practice name and address to be confirmed.",
	},
] as const;

export const contact = {
	secretaryLabel: "Secretary / PA",
	name: "Name to be confirmed",
	email: "email@to-be-confirmed.example",
	phone: "Phone to be confirmed",
};

export const booking = {
	intro:
		"Booking an appointment with Dr Sayal is simple — use the calendar below to view available slots and book a consultation online, or contact the secretary directly.",
	note: "Online booking calendar placeholder — connect your preferred booking platform (e.g. Calendly, Cliniko, or HCA booking) when ready.",
};
