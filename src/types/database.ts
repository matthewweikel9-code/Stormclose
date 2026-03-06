export type SubscriptionTier = "free" | "pro" | "pro_plus" | "trial";

export type Database = {
	public: {
		Tables: {
			email_drafts: {
				Row: {
					id: string;
					user_id: string;
					report_id: string | null;
					subject: string;
					body: string;
					recipient_type: string;
					template_type: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					report_id?: string | null;
					subject: string;
					body: string;
					recipient_type?: string;
					template_type?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					report_id?: string | null;
					subject?: string;
					body?: string;
					recipient_type?: string;
					template_type?: string;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			roof_photos: {
				Row: {
					id: string;
					user_id: string;
					report_id: string | null;
					photo_url: string;
					storage_path: string;
					analysis: Record<string, unknown> | null;
					damage_types: string[];
					confidence_score: number | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					report_id?: string | null;
					photo_url: string;
					storage_path: string;
					analysis?: Record<string, unknown> | null;
					damage_types?: string[];
					confidence_score?: number | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					report_id?: string | null;
					photo_url?: string;
					storage_path?: string;
					analysis?: Record<string, unknown> | null;
					damage_types?: string[];
					confidence_score?: number | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			objections: {
				Row: {
					id: string;
					user_id: string;
					homeowner_name: string | null;
					objection: string;
					project_type: string;
					key_benefits: string[];
					evidence_points: string[];
					tone: "consultative" | "confident" | "empathetic";
					response_content: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					homeowner_name?: string | null;
					objection: string;
					project_type: string;
					key_benefits: string[];
					evidence_points?: string[];
					tone: "consultative" | "confident" | "empathetic";
					response_content: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					homeowner_name?: string | null;
					objection?: string;
					project_type?: string;
					key_benefits?: string[];
					evidence_points?: string[];
					tone?: "consultative" | "confident" | "empathetic";
					response_content?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			followups: {
				Row: {
					id: string;
					user_id: string;
					homeowner_name: string;
					inspection_date: string;
					status: "waiting_on_insurance" | "undecided" | "ghosted";
					followup_content: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					homeowner_name: string;
					inspection_date: string;
					status: "waiting_on_insurance" | "undecided" | "ghosted";
					followup_content: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					homeowner_name?: string;
					inspection_date?: string;
					status?: "waiting_on_insurance" | "undecided" | "ghosted";
					followup_content?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			reports: {
				Row: {
					id: string;
					user_id: string;
					property_address: string;
					roof_type: string;
					shingle_type: string;
					damage_notes: string;
					insurance_company: string;
					slopes_damaged: number;
					report_content: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					property_address: string;
					roof_type: string;
					shingle_type: string;
					damage_notes: string;
					insurance_company: string;
					slopes_damaged: number;
					report_content: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					property_address?: string;
					roof_type?: string;
					shingle_type?: string;
					damage_notes?: string;
					insurance_company?: string;
					slopes_damaged?: number;
					report_content?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			users: {
				Row: {
					id: string;
					email: string | null;
					stripe_customer_id: string | null;
					stripe_subscription_id: string | null;
					subscription_status: string | null;
					subscription_tier: SubscriptionTier;
					trial_end: string | null;
					reports_this_month: number;
					reports_reset_at: string;
				};
				Insert: {
					id: string;
					email?: string | null;
					stripe_customer_id?: string | null;
					stripe_subscription_id?: string | null;
					subscription_status?: string | null;
					subscription_tier?: SubscriptionTier;
					trial_end?: string | null;
					reports_this_month?: number;
					reports_reset_at?: string;
				};
				Update: {
					id?: string;
					email?: string | null;
					stripe_customer_id?: string | null;
					stripe_subscription_id?: string | null;
					subscription_status?: string | null;
					subscription_tier?: SubscriptionTier;
					trial_end?: string | null;
					reports_this_month?: number;
					reports_reset_at?: string;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};
