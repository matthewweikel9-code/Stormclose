// Comprehensive Roofing Objection Library
// 50+ common objections categorized for quick reference

export type ObjectionCategory = 
	| "price"
	| "trust"
	| "timing"
	| "process"
	| "competition"
	| "insurance"
	| "decision";

export interface ObjectionTemplate {
	id: string;
	category: ObjectionCategory;
	objection: string;
	shortTitle: string;
	suggestedTone: "consultative" | "confident" | "empathetic";
	keyInsights: string[];
	suggestedResponse: string;
}

export const OBJECTION_CATEGORIES: Record<ObjectionCategory, { label: string; icon: string; color: string }> = {
	price: { label: "Price & Budget", icon: "💰", color: "bg-green-100 text-green-800" },
	trust: { label: "Trust & Credibility", icon: "🤝", color: "bg-blue-100 text-blue-800" },
	timing: { label: "Timing & Urgency", icon: "⏰", color: "bg-yellow-100 text-yellow-800" },
	process: { label: "Process & Logistics", icon: "📋", color: "bg-purple-100 text-purple-800" },
	competition: { label: "Competition", icon: "🏆", color: "bg-orange-100 text-orange-800" },
	insurance: { label: "Insurance & Claims", icon: "📑", color: "bg-cyan-100 text-cyan-800" },
	decision: { label: "Decision Making", icon: "🤔", color: "bg-pink-100 text-pink-800" }
};

export const OBJECTION_LIBRARY: ObjectionTemplate[] = [
	// PRICE OBJECTIONS
	{
		id: "price-1",
		category: "price",
		objection: "Your price is higher than the other quotes I got.",
		shortTitle: "Higher than competitors",
		suggestedTone: "consultative",
		keyInsights: [
			"Compare scope, not just price",
			"Material quality differences",
			"Warranty terms and coverage"
		],
		suggestedResponse: "I appreciate you comparing quotes—that's smart. Let me ask: are we comparing the same materials and warranty? A $2,000 savings now can cost $10,000+ later if they cut corners on underlayment or use builder-grade shingles. Can I see the other quote to show you exactly where we differ?"
	},
	{
		id: "price-2",
		category: "price",
		objection: "I wasn't planning on spending that much on a roof.",
		shortTitle: "Budget concerns",
		suggestedTone: "empathetic",
		keyInsights: [
			"Financing options available",
			"Insurance may cover more",
			"Cost of waiting/leaks"
		],
		suggestedResponse: "I completely understand—a roof is a significant investment. Here's what I'd suggest: let's see what insurance covers first. Most homeowners are surprised at how much their claim pays. Plus, we offer 0% financing for 18 months if you need to bridge the gap. Would it help to see our financing options?"
	},
	{
		id: "price-3",
		category: "price",
		objection: "Can you give me a better price?",
		shortTitle: "Discount request",
		suggestedTone: "confident",
		keyInsights: [
			"Value over price",
			"What's included in quote",
			"Payment timing options"
		],
		suggestedResponse: "I priced this with quality materials and proper installation in mind—I can't cut corners and put my name on it. What I can offer is a $500 credit if you commit this week while I have crew availability, or we can adjust the scope. What matters most to you: the total price or the monthly payment?"
	},
	{
		id: "price-4",
		category: "price",
		objection: "We can't afford a new roof right now.",
		shortTitle: "Can't afford it",
		suggestedTone: "empathetic",
		keyInsights: [
			"Insurance claim process",
			"Financing with low payments",
			"Cost of delay"
		],
		suggestedResponse: "I hear you. Here's the thing—if this damage is covered by insurance, your out-of-pocket is just your deductible. Let me file the claim for you at no cost. If it's not covered, we have financing as low as $150/month. Would it help to explore both options?"
	},
	{
		id: "price-5",
		category: "price",
		objection: "The other company is $5,000 cheaper.",
		shortTitle: "Significantly cheaper competitor",
		suggestedTone: "consultative",
		keyInsights: [
			"Red flags in low bids",
			"Scope comparison",
			"Risk of cheap work"
		],
		suggestedResponse: "That's a big difference—which makes me want to look at their quote carefully. In my experience, a $5K gap usually means different materials, no tear-off, or they're not including something. Can you share their quote? I'll show you exactly where they're cutting costs so you can make an informed decision."
	},
	{
		id: "price-6",
		category: "price",
		objection: "I need to wait until I have more money saved.",
		shortTitle: "Need to save more",
		suggestedTone: "empathetic",
		keyInsights: [
			"Damage progression",
			"Financing options",
			"Insurance timing"
		],
		suggestedResponse: "I understand wanting to be financially prepared. Here's my concern: with the damage I documented today, waiting could mean interior leaks, mold, or structural damage—turning a $12,000 roof into a $25,000 repair. Our financing can get you to $100-150/month. Would that work better than waiting?"
	},

	// TRUST OBJECTIONS
	{
		id: "trust-1",
		category: "trust",
		objection: "I've heard bad things about roofing contractors.",
		shortTitle: "Contractor reputation concerns",
		suggestedTone: "confident",
		keyInsights: [
			"Industry has bad actors",
			"Your credentials/reviews",
			"Verification steps"
		],
		suggestedResponse: "You're right to be cautious—our industry has its share of bad actors, especially after storms. Here's what sets us apart: we're GAF Master Elite certified (top 2% of roofers), fully insured with $2M coverage, and have a 4.9-star rating from 200+ reviews. I'll give you references in your neighborhood. Want me to send our credentials?"
	},
	{
		id: "trust-2",
		category: "trust",
		objection: "How do I know you'll actually do what you say?",
		shortTitle: "Trust in promises",
		suggestedTone: "confident",
		keyInsights: [
			"Written guarantees",
			"Warranties",
			"References available"
		],
		suggestedResponse: "Everything I promise is in writing—10-year workmanship warranty on top of the manufacturer warranty. I don't get paid until you're satisfied. Here are three homeowners on your street I've done work for—feel free to knock on their door. And check our Google reviews. Fair enough?"
	},
	{
		id: "trust-3",
		category: "trust",
		objection: "I've never heard of your company before.",
		shortTitle: "Unknown company",
		suggestedTone: "consultative",
		keyInsights: [
			"Company history",
			"Local presence",
			"Credentials"
		],
		suggestedResponse: "We've been serving this area for 8 years, but you're right—we don't do a lot of advertising. Our business is mostly referrals. In fact, I've done 12 roofs in your subdivision this year alone. Here's my license, insurance certificate, and manufacturer certifications. Would you like me to send references from your neighbors?"
	},
	{
		id: "trust-4",
		category: "trust",
		objection: "I'd rather use someone I know.",
		shortTitle: "Prefer known contractor",
		suggestedTone: "empathetic",
		keyInsights: [
			"Understand the preference",
			"Specialization matters",
			"Insurance claim expertise"
		],
		suggestedResponse: "I completely understand—trust is everything. Let me ask: does your contact specialize in insurance restoration? The claims process is specific—if your contractor doesn't know Xactimate pricing and supplement procedures, you could leave money on the table. I'd be happy to just give you a second opinion at no cost."
	},
	{
		id: "trust-5",
		category: "trust",
		objection: "Storm chasers come through here after every storm.",
		shortTitle: "Storm chaser concerns",
		suggestedTone: "confident",
		keyInsights: [
			"Local business",
			"Physical address",
			"Long-term warranty"
		],
		suggestedResponse: "I'm glad you're skeptical—storm chasers give us all a bad name. Here's the difference: I have a physical office at [address], I've been here for 8 years, and my warranty is backed by GAF—not disappearing when I leave town. Let me give you my local references. If I were a storm chaser, would I have 200+ reviews here?"
	},

	// TIMING OBJECTIONS
	{
		id: "timing-1",
		category: "timing",
		objection: "I need to think about it.",
		shortTitle: "Need to think about it",
		suggestedTone: "consultative",
		keyInsights: [
			"Understand the real concern",
			"Time-sensitive factors",
			"Leave valuable info"
		],
		suggestedResponse: "Absolutely—this is a big decision. I want you to feel confident. What specifically would you like to think through? Is it the investment, the timing, or the company? I ask because your insurance claim window does have a deadline, and I want to make sure you have everything you need to decide before it expires."
	},
	{
		id: "timing-2",
		category: "timing",
		objection: "This isn't a good time for us.",
		shortTitle: "Bad timing",
		suggestedTone: "empathetic",
		keyInsights: [
			"Understand circumstances",
			"Insurance deadlines",
			"Flexible scheduling"
		],
		suggestedResponse: "I understand—life gets busy. Here's my concern: the damage I documented is real, and waiting means it could get worse. If it's a scheduling thing, I can work around you—early mornings, weekends, whatever works. What would make the timing better?"
	},
	{
		id: "timing-3",
		category: "timing",
		objection: "The roof seems fine to me.",
		shortTitle: "Roof looks fine",
		suggestedTone: "consultative",
		keyInsights: [
			"Hidden damage",
			"Test square methodology",
			"Insurance documentation"
		],
		suggestedResponse: "From the ground, it does look okay—hail damage isn't always visible from below. But when I was up there, I found 8+ impacts per test square, which is what insurance requires for replacement. Let me show you the photos. The damage is real, but the good news is insurance should cover it."
	},
	{
		id: "timing-4",
		category: "timing",
		objection: "I want to wait and see if it leaks first.",
		shortTitle: "Wait for leaks",
		suggestedTone: "empathetic",
		keyInsights: [
			"Secondary damage risks",
			"Insurance may deny later",
			"Cost multiplication"
		],
		suggestedResponse: "I understand wanting proof, but here's the problem: by the time water comes inside, you're looking at mold, drywall, insulation—potentially $20,000+ in additional damage. And insurance may deny that claim because the original damage wasn't addressed. It's much safer to fix it now while it's just the roof."
	},
	{
		id: "timing-5",
		category: "timing",
		objection: "We're selling the house soon anyway.",
		shortTitle: "Selling soon",
		suggestedTone: "consultative",
		keyInsights: [
			"Buyer inspection findings",
			"Price negotiation impact",
			"Transfer of claim"
		],
		suggestedResponse: "Actually, a new roof is a selling point—and the buyer's inspector will find this damage. You can either fix it now with insurance covering most of it, or have buyers negotiate $15-20K off your price. Plus, you can transfer the warranty to the buyer. Would you like to explore getting this done before listing?"
	},

	// PROCESS OBJECTIONS
	{
		id: "process-1",
		category: "process",
		objection: "How long is this going to take?",
		shortTitle: "Timeline concerns",
		suggestedTone: "confident",
		keyInsights: [
			"Typical timeline",
			"Weather factors",
			"Minimal disruption"
		],
		suggestedResponse: "Great question. Most residential roofs take 1-2 days for installation. With insurance claims, the total process is about 2-3 weeks from filing to completion. We start early, clean up daily, and you can stay in your home the whole time. I'll give you a specific timeline once we have the adjuster's approval."
	},
	{
		id: "process-2",
		category: "process",
		objection: "I don't want the hassle of an insurance claim.",
		shortTitle: "Insurance hassle",
		suggestedTone: "empathetic",
		keyInsights: [
			"We handle everything",
			"Documentation provided",
			"No cost if denied"
		],
		suggestedResponse: "I handle 95% of the claim process for you—filing paperwork, meeting the adjuster, negotiating supplements. All you do is sign a few forms and answer your adjuster's call. Most homeowners are surprised how easy it is. And if the claim is denied, you owe me nothing. Why not let me try?"
	},
	{
		id: "process-3",
		category: "process",
		objection: "Will this affect my insurance rates?",
		shortTitle: "Rate increase concerns",
		suggestedTone: "consultative",
		keyInsights: [
			"Weather claims typically don't",
			"Already on record",
			"Benefits outweigh risk"
		],
		suggestedResponse: "Legitimate weather damage claims typically don't raise rates—insurance companies expect storm claims. And here's the thing: that hail storm is already in their weather database. The question is whether you get a new roof from it or not. Either way, the storm is on record."
	},
	{
		id: "process-4",
		category: "process",
		objection: "What about my landscaping/property?",
		shortTitle: "Property protection",
		suggestedTone: "confident",
		keyInsights: [
			"Protection protocols",
			"Daily cleanup",
			"Damage coverage"
		],
		suggestedResponse: "Great question—we protect your property like it's our own. We use tarps and plywood on landscaping, magnetic rollers to catch nails, and clean up daily. If anything does get damaged—which is rare—we fix it or it comes out of my pay. I take photos before and after. Fair?"
	},

	// COMPETITION OBJECTIONS
	{
		id: "comp-1",
		category: "competition",
		objection: "I'm getting other quotes first.",
		shortTitle: "Getting other quotes",
		suggestedTone: "consultative",
		keyInsights: [
			"Respect the process",
			"Comparison guidance",
			"Stay in touch"
		],
		suggestedResponse: "Smart—I'd do the same thing. When you compare quotes, here's what to look for: same shingle quality, same underlayment, tear-off included, and warranty terms. A lot of low bids skip the tear-off or use cheap felt. Can I leave you a comparison checklist? And I'd appreciate a chance to match or explain any differences."
	},
	{
		id: "comp-2",
		category: "competition",
		objection: "Another company said they'd do it for free with insurance.",
		shortTitle: "Free roof promise",
		suggestedTone: "confident",
		keyInsights: [
			"Red flag warning",
			"Insurance fraud implications",
			"Your responsibility"
		],
		suggestedResponse: "That's a major red flag. If they're promising a 'free roof,' they're either inflating the claim (which is fraud—with your name on the paperwork) or they're going to ask for your deductible payment later. Insurance fraud can void your policy. I work within the claim, maximize it legitimately, and you pay only your deductible."
	},
	{
		id: "comp-3",
		category: "competition",
		objection: "The other company has better reviews.",
		shortTitle: "Better competitor reviews",
		suggestedTone: "consultative",
		keyInsights: [
			"Review authenticity",
			"Specific references",
			"Local track record"
		],
		suggestedResponse: "I'd love to see who you're comparing us to—not every review platform is equal, and some reviews can be bought. Here's what I'd suggest: ask both of us for 3 references in your neighborhood that you can actually call or visit. Real homeowners don't lie. Want the names of my local jobs?"
	},
	{
		id: "comp-4",
		category: "competition",
		objection: "I already have a roofer I work with.",
		shortTitle: "Existing roofer relationship",
		suggestedTone: "empathetic",
		keyInsights: [
			"Respect relationship",
			"Specialized expertise",
			"Second opinion value"
		],
		suggestedResponse: "I respect that—loyalty matters. Does your roofer specialize in insurance restoration? The claims process is very specific, and leaving money on the table happens often. Even if you go with them, I'm happy to provide a free second opinion on the scope. No obligation."
	},

	// INSURANCE OBJECTIONS
	{
		id: "ins-1",
		category: "insurance",
		objection: "My insurance won't cover this.",
		shortTitle: "Won't be covered",
		suggestedTone: "consultative",
		keyInsights: [
			"Let me file to find out",
			"Documentation strength",
			"No cost if denied"
		],
		suggestedResponse: "You might be surprised. I've documented significant damage that meets Haag Engineering standards. Most adjusters approve claims with this level of documentation. Let me file at no cost to you—if it's denied, you owe me nothing. What do you have to lose?"
	},
	{
		id: "ins-2",
		category: "insurance",
		objection: "I already filed a claim and was denied.",
		shortTitle: "Already denied",
		suggestedTone: "confident",
		keyInsights: [
			"Re-inspection rights",
			"Supplemental documentation",
			"Adjuster second opinion"
		],
		suggestedResponse: "That's frustrating, but not the end. You're entitled to a re-inspection, and often the first adjuster missed something. I've overturned denials by providing better documentation with Haag methodology and test square photos. Let me review what they said and see if I can get it reopened. No charge if I can't."
	},
	{
		id: "ins-3",
		category: "insurance",
		objection: "My deductible is too high.",
		shortTitle: "High deductible",
		suggestedTone: "empathetic",
		keyInsights: [
			"Deductible is your responsibility",
			"Financing for deductible",
			"New roof value"
		],
		suggestedResponse: "I understand—high deductibles are tough. Here's how I see it: you're essentially getting a $15,000+ roof for $2,500. We can even set up a small payment plan for the deductible if that helps. You'd be hard-pressed to find a better ROI on that $2,500."
	},
	{
		id: "ins-4",
		category: "insurance",
		objection: "I don't want my insurance to cancel me.",
		shortTitle: "Policy cancellation fear",
		suggestedTone: "consultative",
		keyInsights: [
			"Weather claims are normal",
			"Non-renewal vs cancellation",
			"Already in system"
		],
		suggestedResponse: "Legitimate weather claims rarely cause cancellation—that's what insurance is for. And here's the thing: the storm is already in their weather database. A bigger risk is NOT fixing it and having interior water damage later, which CAN affect your policy. Let's get you protected properly."
	},
	{
		id: "ins-5",
		category: "insurance",
		objection: "The adjuster said it's just cosmetic damage.",
		shortTitle: "Cosmetic damage only",
		suggestedTone: "confident",
		keyInsights: [
			"Functional vs cosmetic",
			"Haag standards",
			"Re-inspection rights"
		],
		suggestedResponse: "I'd respectfully disagree with that assessment. What I documented shows granule loss with mat exposure—that's functional damage, not cosmetic, per Haag Engineering standards. You have the right to request a re-inspection with a different adjuster. Would you like me to help you appeal?"
	},

	// DECISION-MAKING OBJECTIONS
	{
		id: "decide-1",
		category: "decision",
		objection: "I need to talk to my spouse first.",
		shortTitle: "Spouse consultation",
		suggestedTone: "consultative",
		keyInsights: [
			"Involve them now if possible",
			"Provide materials",
			"Schedule follow-up"
		],
		suggestedResponse: "Absolutely—this is a joint decision. Is your spouse available for a quick call now? If not, I'll leave you this folder with photos, the estimate, and our warranty info so you can discuss tonight. What time tomorrow works for a follow-up call? I know your schedules are busy."
	},
	{
		id: "decide-2",
		category: "decision",
		objection: "I'm not ready to sign anything today.",
		shortTitle: "Not ready to commit",
		suggestedTone: "empathetic",
		keyInsights: [
			"Understand the hesitation",
			"What's holding them back",
			"Provide info to decide"
		],
		suggestedResponse: "No pressure at all—I don't believe in high-pressure sales. Help me understand what you need to feel ready. Is it more information? More time? Other quotes? I want to make sure you have everything you need. And just so you know, your insurance claim window is time-sensitive."
	},
	{
		id: "decide-3",
		category: "decision",
		objection: "I don't make quick decisions.",
		shortTitle: "Slow decision maker",
		suggestedTone: "empathetic",
		keyInsights: [
			"Respect their process",
			"Provide resources",
			"Note time-sensitive factors"
		],
		suggestedResponse: "I respect that—careful decisions are usually better decisions. Here's what I'll do: I'll leave you with all the documentation, my credentials, references, and the quote. Take your time. The only time-sensitive factor is your insurance claim window—can you commit to deciding before [date]?"
	},
	{
		id: "decide-4",
		category: "decision",
		objection: "Let me do some research first.",
		shortTitle: "Want to research",
		suggestedTone: "consultative",
		keyInsights: [
			"Offer to help research",
			"Point to trusted sources",
			"Send comparison checklist"
		],
		suggestedResponse: "Smart approach. Here's what I'd look into if I were you: GAF certification (top 2% of roofers), Google reviews (look for photo evidence), and BBB rating. I'll send you a checklist of questions to ask any roofer you talk to. Fair warning though—some companies will tell you what you want to hear. My number's on there for when you're ready."
	},
	{
		id: "decide-5",
		category: "decision",
		objection: "I just don't want to deal with this right now.",
		shortTitle: "Don't want to deal with it",
		suggestedTone: "empathetic",
		keyInsights: [
			"Acknowledge the burden",
			"We handle everything",
			"Consequences of waiting"
		],
		suggestedResponse: "I get it—nobody wants to think about roofing. Here's the thing: I do this every day. If you just sign the authorization, I handle everything—filing the claim, meeting the adjuster, coordinating the work. You'll barely notice we're here. What I don't want is for you to forget about it and end up with leaks or a denied claim later."
	}
];

export function getObjectionsByCategory(category: ObjectionCategory): ObjectionTemplate[] {
	return OBJECTION_LIBRARY.filter(obj => obj.category === category);
}

export function searchObjections(query: string): ObjectionTemplate[] {
	const lowerQuery = query.toLowerCase();
	return OBJECTION_LIBRARY.filter(obj => 
		obj.objection.toLowerCase().includes(lowerQuery) ||
		obj.shortTitle.toLowerCase().includes(lowerQuery) ||
		obj.suggestedResponse.toLowerCase().includes(lowerQuery)
	);
}

export function getRandomObjections(count: number = 5): ObjectionTemplate[] {
	const shuffled = [...OBJECTION_LIBRARY].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}
