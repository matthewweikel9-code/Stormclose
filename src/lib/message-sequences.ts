// Multi-Touch Follow-Up Message Sequences
// Pre-built sequences for different customer situations

export type SequenceType = 
	| "post-inspection"
	| "waiting-insurance"
	| "quote-sent"
	| "ghosted"
	| "post-work"
	| "referral";

export interface SequenceMessage {
	day: number;
	subject?: string;
	channel: "text" | "email" | "call";
	tone: "friendly" | "professional" | "urgent" | "empathetic";
	template: string;
	purpose: string;
}

export interface MessageSequence {
	id: string;
	name: string;
	type: SequenceType;
	description: string;
	totalDays: number;
	messages: SequenceMessage[];
	bestFor: string[];
}

export const SEQUENCE_TYPES: Record<SequenceType, { label: string; icon: string; color: string }> = {
	"post-inspection": { label: "Post-Inspection", icon: "🔍", color: "bg-blue-100 text-blue-800" },
	"waiting-insurance": { label: "Insurance Pending", icon: "📋", color: "bg-yellow-100 text-yellow-800" },
	"quote-sent": { label: "Quote Follow-Up", icon: "💰", color: "bg-green-100 text-green-800" },
	"ghosted": { label: "Re-Engagement", icon: "👻", color: "bg-purple-100 text-purple-800" },
	"post-work": { label: "Post-Completion", icon: "✅", color: "bg-emerald-100 text-emerald-800" },
	"referral": { label: "Referral Request", icon: "🤝", color: "bg-pink-100 text-pink-800" }
};

export const MESSAGE_SEQUENCES: MessageSequence[] = [
	{
		id: "post-inspection-standard",
		name: "Post-Inspection Standard",
		type: "post-inspection",
		description: "7-day sequence for homeowners who just received an inspection",
		totalDays: 7,
		bestFor: ["New leads", "Storm damage discovered", "Insurance claim eligible"],
		messages: [
			{
				day: 0,
				channel: "text",
				tone: "friendly",
				purpose: "Thank you and set expectations",
				template: `Hi {name}! Thanks for taking time today to walk the property with me. As promised, I'm putting together your damage report with photos. I'll have that over to you by tomorrow afternoon. If you have any questions in the meantime, just text me back! 👍`
			},
			{
				day: 1,
				channel: "email",
				subject: "Your Roof Inspection Report - {address}",
				tone: "professional",
				purpose: "Deliver report and outline next steps",
				template: `Hi {name},

Attached is your complete roof inspection report for {address}. Here's a quick summary:

• Damage Found: [Summarize key findings]
• Recommended Action: [Repair/Replacement]
• Insurance Status: [Claim-eligible / Out of pocket]

NEXT STEPS:
1. Review the attached report
2. I'll call you tomorrow to answer any questions
3. If filing a claim, I'll walk you through the process

This damage is covered under your homeowner's policy, and I handle most of the paperwork for you.

Talk soon,
{your_name}
{company}`
			},
			{
				day: 2,
				channel: "call",
				tone: "professional",
				purpose: "Discuss report, answer questions, schedule next step",
				template: `CALL SCRIPT:
"Hi {name}, this is {your_name} calling to follow up on the inspection report I sent yesterday. Did you have a chance to look it over? [PAUSE]

Great - what questions came up for you? [ANSWER QUESTIONS]

The next step is [filing the claim / scheduling the adjuster / reviewing the quote]. Would you like me to walk you through that process now, or would [tomorrow morning / this afternoon] work better for a quick call?"`
			},
			{
				day: 4,
				channel: "text",
				tone: "friendly",
				purpose: "Check-in and offer help",
				template: `Hey {name}! Just checking in - have you had a chance to review the report? Happy to hop on a quick call if you have questions. Also, I'm in your neighborhood tomorrow if you'd prefer to chat in person. 🏠`
			},
			{
				day: 7,
				channel: "email",
				subject: "Quick question about your roof, {name}",
				tone: "professional",
				purpose: "Soft close or identify concerns",
				template: `Hi {name},

I wanted to follow up one more time about your roof inspection. I know life gets busy!

Quick question: Is there anything holding you back from moving forward? Whether it's:
• Timing concerns
• Budget questions
• Wanting additional quotes
• Insurance uncertainty

I'm happy to address whatever's on your mind. No pressure - I just want to make sure you have everything you need to protect your home.

Best,
{your_name}`
			}
		]
	},
	{
		id: "insurance-waiting",
		name: "Insurance Claim Pending",
		type: "waiting-insurance",
		description: "14-day sequence while waiting on insurance adjuster or decision",
		totalDays: 14,
		bestFor: ["Claim filed", "Waiting for adjuster", "Supplement pending"],
		messages: [
			{
				day: 0,
				channel: "text",
				tone: "professional",
				purpose: "Confirm claim filed and set expectations",
				template: `Hi {name}! Your insurance claim has been filed. Typical timeline: 5-10 business days for adjuster assignment. I'll reach out to your carrier in a few days to check status. I'll keep you posted! 📋`
			},
			{
				day: 3,
				channel: "email",
				subject: "Insurance Claim Update - {address}",
				tone: "professional",
				purpose: "Status check and transparency",
				template: `Hi {name},

Quick update on your insurance claim:

Claim Number: {claim_number}
Status: Pending adjuster assignment
Filed: {date_filed}

I called {insurance_company} today to check on timing. They confirmed receipt and said an adjuster should reach out within [X days].

I'll be present for the adjuster meeting to ensure nothing is missed. Once we have a date, I'll send you a prep checklist.

Any questions in the meantime?

{your_name}`
			},
			{
				day: 7,
				channel: "text",
				tone: "friendly",
				purpose: "Check if adjuster contacted them",
				template: `Hey {name}! Has anyone from {insurance_company} reached out yet to schedule the inspection? Let me know - I want to make sure I'm there when they come out. 👍`
			},
			{
				day: 10,
				channel: "call",
				tone: "professional",
				purpose: "Proactive check-in and escalation if needed",
				template: `CALL SCRIPT:
"Hi {name}, this is {your_name}. I wanted to check in on your insurance claim. Have you heard from the adjuster yet? [IF NO] That's taking a bit longer than usual. Would you like me to call them on your behalf to expedite? I do this regularly and can often move things along faster."`
			},
			{
				day: 14,
				channel: "email",
				subject: "Next steps on your roof claim",
				tone: "professional",
				purpose: "Summarize status and next actions",
				template: `Hi {name},

Two weeks into your insurance claim - here's where we stand:

✓ Claim filed: {date_filed}
[✓/Pending] Adjuster assigned
[✓/Pending] Inspection scheduled
[✓/Pending] Estimate received

NEXT STEPS:
• [If waiting]: I'll follow up with {insurance_company} again this week
• [If scheduled]: I'll see you at the adjuster meeting on [date]
• [If approved]: Let's schedule your installation

Questions? Call me anytime.

{your_name}`
			}
		]
	},
	{
		id: "quote-followup",
		name: "Quote Decision Follow-Up",
		type: "quote-sent",
		description: "10-day sequence after sending an estimate",
		totalDays: 10,
		bestFor: ["Estimate delivered", "Cash job", "Multiple quote situation"],
		messages: [
			{
				day: 0,
				channel: "email",
				subject: "Your Roof Estimate - {address}",
				tone: "professional",
				purpose: "Deliver estimate with clear value props",
				template: `Hi {name},

Attached is your detailed estimate for {address}.

ESTIMATE SUMMARY:
• Scope: [Full replacement / Repair]
• Materials: [Shingle type]
• Investment: {amount}
• Timeline: [X] days to complete

WHAT'S INCLUDED:
✓ Premium materials with [X]-year warranty
✓ Full tear-off and deck inspection
✓ Ice & water shield in valleys and eaves
✓ Complete cleanup with magnetic sweep
✓ 10-year workmanship guarantee

This estimate is valid for 30 days. I'm happy to walk through it line by line if you'd like.

{your_name}
{company}`
			},
			{
				day: 2,
				channel: "text",
				tone: "friendly",
				purpose: "Quick check-in",
				template: `Hi {name}! Just wanted to make sure you received the estimate. Any questions I can answer? 😊`
			},
			{
				day: 4,
				channel: "call",
				tone: "professional",
				purpose: "Discuss quote, handle objections",
				template: `CALL SCRIPT:
"Hi {name}, this is {your_name} following up on the estimate I sent over. Did you have a chance to review it? [PAUSE]

What questions came up for you? [HANDLE OBJECTIONS]

If everything looks good, I have some availability [next week / this week]. Would [Tuesday or Thursday] work better for getting started?"`
			},
			{
				day: 7,
				channel: "email",
				subject: "Still thinking about your roof?",
				tone: "friendly",
				purpose: "Address concerns, provide social proof",
				template: `Hi {name},

I know roof decisions take time - it's a big investment!

A few things that might help:
• We just finished 3 roofs in {neighborhood} this month
• Our Google reviews: [link]
• Financing available: As low as {monthly}/month

If you're comparing quotes, I'm happy to review what others proposed. Sometimes it's not apples to apples.

What would help you feel confident moving forward?

{your_name}`
			},
			{
				day: 10,
				channel: "text",
				tone: "professional",
				purpose: "Final check before moving on",
				template: `Hi {name}, I wanted to check in one last time about the roof estimate. Is this still on your radar, or have things changed? Either way, no pressure - just want to make sure you're taken care of. 🏠`
			}
		]
	},
	{
		id: "ghosted-reengagement",
		name: "Ghosted Lead Re-Engagement",
		type: "ghosted",
		description: "21-day sequence to re-engage unresponsive leads",
		totalDays: 21,
		bestFor: ["No response 2+ weeks", "Was interested then went silent", "Needs gentle re-engagement"],
		messages: [
			{
				day: 0,
				channel: "text",
				tone: "friendly",
				purpose: "Soft, no-pressure check-in",
				template: `Hey {name}, hope you're doing well! Just wanted to check in - no pressure at all. Still happy to help whenever you're ready. 👋`
			},
			{
				day: 7,
				channel: "email",
				subject: "Did I miss something?",
				tone: "empathetic",
				purpose: "Acknowledge and offer an out",
				template: `Hi {name},

I wanted to reach out one more time. I know things get busy, and roofing isn't exactly top of mind!

If you've decided to go a different direction, no hard feelings at all - I just want to make sure I didn't leave any questions unanswered.

If timing is the issue, I'm happy to circle back in a few months.

Either way, let me know where you're at. I'm here to help when you're ready.

{your_name}`
			},
			{
				day: 14,
				channel: "text",
				tone: "professional",
				purpose: "Value-add check-in",
				template: `Hi {name}! Quick heads up - we're running a special this month: free gutter cleaning with any roof project. Thought of you! Let me know if you'd like to chat.`
			},
			{
				day: 21,
				channel: "email",
				subject: "Should I close your file?",
				tone: "professional",
				purpose: "Final attempt with urgency",
				template: `Hi {name},

I'm doing some housekeeping on my active projects and wanted to check in before closing your file.

The damage we documented at {address} is still there, and I want to make sure you're protected before it becomes a bigger issue.

Should I:
A) Keep your file open and check back in a month?
B) Close it out for now?

Just reply with A or B. Either way, I appreciate the opportunity to inspect your roof.

{your_name}`
			}
		]
	},
	{
		id: "post-completion",
		name: "Post-Job Satisfaction",
		type: "post-work",
		description: "30-day sequence after completing a roofing job",
		totalDays: 30,
		bestFor: ["Job completed", "Happy customer", "Review and referral potential"],
		messages: [
			{
				day: 0,
				channel: "text",
				tone: "friendly",
				purpose: "Same-day completion check-in",
				template: `Hi {name}! Your new roof is complete! 🎉 Everything look good from your end? Let me know if you notice anything at all - I want to make sure you're 100% happy.`
			},
			{
				day: 3,
				channel: "email",
				subject: "Your Roof Warranty Information",
				tone: "professional",
				purpose: "Deliver warranty docs and set expectations",
				template: `Hi {name},

Congratulations on your new roof! Here's everything you need for your records:

ATTACHED:
✓ Manufacturer warranty registration
✓ Our 10-year workmanship warranty
✓ Final inspection photos
✓ Care & maintenance guide

YOUR WARRANTY COVERS:
• Materials: [X] years
• Workmanship: 10 years
• Transferable to new owners

Save this email with your home documents. If you ever have questions, just reach out!

Enjoy your new roof,
{your_name}`
			},
			{
				day: 7,
				channel: "text",
				tone: "friendly",
				purpose: "Request review",
				template: `Hi {name}! How's the new roof treating you? If you're happy with everything, I'd really appreciate a quick Google review - it helps other homeowners find us: [link] Thank you! 🙏`
			},
			{
				day: 14,
				channel: "email",
				subject: "Quick favor, {name}?",
				tone: "friendly",
				purpose: "Referral request",
				template: `Hi {name},

Hope you're enjoying your new roof! I have a quick favor to ask.

Do you know anyone else - neighbors, family, coworkers - who might need roofing help? I'd love to take care of them the same way I took care of you.

As a thank you, I offer a $250 referral bonus for any job that closes.

No pressure at all - I just love working with people who come from great customers like you!

Thanks again,
{your_name}`
			},
			{
				day: 30,
				channel: "text",
				tone: "friendly",
				purpose: "30-day check and referral reminder",
				template: `Hey {name}! Just checking in a month later - how's everything holding up? 🏠 Remember, if you know anyone who needs roof help, I'd love to take care of them! Have a great week.`
			}
		]
	},
	{
		id: "referral-request",
		name: "Referral Generation",
		type: "referral",
		description: "Sequence for actively generating referrals from past customers",
		totalDays: 14,
		bestFor: ["Past satisfied customers", "1+ year since job", "Referral campaign"],
		messages: [
			{
				day: 0,
				channel: "email",
				subject: "How's your roof holding up, {name}?",
				tone: "friendly",
				purpose: "Re-engage and check satisfaction",
				template: `Hi {name}!

It's been a while since we installed your new roof at {address}. I just wanted to check in - how's everything holding up?

I was in your neighborhood this week and it reminded me of what a great project that was.

Any issues at all, just let me know. That's what the warranty is for!

Hope you're doing well,
{your_name}`
			},
			{
				day: 3,
				channel: "text",
				tone: "friendly",
				purpose: "Soft referral ask",
				template: `Hi {name}! Hope you got my email. Quick question - do you know anyone who's been dealing with roof issues? I'd love to help them out the same way. No worries if not! 👍`
			},
			{
				day: 7,
				channel: "email",
				subject: "$250 for you and a new roof for a friend",
				tone: "professional",
				purpose: "Clear referral offer",
				template: `Hi {name},

I'm reaching out to my best customers with a special offer.

FOR EVERY REFERRAL THAT BECOMES A JOB:
• You get: $250 cash or Visa gift card
• They get: $250 off their project
• I get: A great customer

Know anyone who:
• Has storm damage?
• Needs a roof inspection?
• Has been putting off roof repairs?

Just send me their name and number, or have them mention your name when they call.

Thanks for being a great customer!

{your_name}`
			},
			{
				day: 14,
				channel: "text",
				tone: "friendly",
				purpose: "Final gentle reminder",
				template: `Hey {name}! Just a friendly reminder - I'm still offering that $250 referral bonus. If anyone comes to mind who needs roofing help, send them my way! Thanks again for being a great customer. 🏠`
			}
		]
	}
];

export function getSequencesByType(type: SequenceType): MessageSequence[] {
	return MESSAGE_SEQUENCES.filter(seq => seq.type === type);
}

export function getSequenceById(id: string): MessageSequence | undefined {
	return MESSAGE_SEQUENCES.find(seq => seq.id === id);
}

export function personalizeMessage(template: string, variables: Record<string, string>): string {
	let result = template;
	for (const [key, value] of Object.entries(variables)) {
		result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
	}
	return result;
}
