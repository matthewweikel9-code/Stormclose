export type Database = {
	public: {
		Tables: {
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
					subscription_status: string | null;
				};
				Insert: {
					id: string;
					email?: string | null;
					stripe_customer_id?: string | null;
					subscription_status?: string | null;
				};
				Update: {
					id?: string;
					email?: string | null;
					stripe_customer_id?: string | null;
					subscription_status?: string | null;
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
