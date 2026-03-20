import * as XLSX from "xlsx";

const MAX_ROWS = 500;

// --- Partner column mappings ---
const PARTNER_COLUMNS: Record<string, string[]> = {
	name: ["name", "contact", "partner", "partner name"],
	businessName: ["business_name", "business name", "business", "company"],
	email: ["email", "e-mail"],
	phone: ["phone", "tel", "telephone", "mobile"],
	partnerType: ["partner_type", "partner type", "type", "partner type"],
	territory: ["territory", "area", "region"],
	city: ["city"],
	state: ["state", "st"],
	zip: ["zip", "zipcode", "zip code", "postal"],
	tier: ["tier"],
	notes: ["notes", "note", "comments"],
};

// --- Referral column mappings ---
const REFERRAL_COLUMNS: Record<string, string[]> = {
	propertyAddress: ["property_address", "property address", "address", "property", "job address", "location"],
	partnerName: ["partner_name", "partner name", "partner", "source", "referred by", "referred_by"],
	homeownerName: ["homeowner_name", "homeowner name", "homeowner", "customer", "customer name", "name", "owner"],
	homeownerPhone: ["homeowner_phone", "homeowner phone", "phone", "tel", "telephone"],
	homeownerEmail: ["homeowner_email", "homeowner email", "email", "e-mail"],
	city: ["city"],
	state: ["state", "st"],
	zip: ["zip", "zipcode", "zip code", "postal"],
	notes: ["notes", "note", "comments"],
	priority: ["priority"],
	status: ["status"],
};

const PARTNER_TYPES = ["realtor", "insurance_agent", "home_inspector", "property_manager", "contractor", "other"];
const REFERRAL_PRIORITIES = ["low", "normal", "high", "urgent"];
const REFERRAL_STATUSES = ["received", "contacted", "inspection_scheduled", "inspection_complete", "claim_filed", "approved", "roof_installed", "closed", "lost"];

function normalizeHeader(header: string): string {
	return header.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function findColumn(field: string, headers: string[], mappings: Record<string, string[]>): number {
	const aliases = mappings[field];
	if (!aliases) return -1;
	const normalized = normalizeHeader(aliases[0]);
	for (let i = 0; i < headers.length; i++) {
		const h = normalizeHeader(headers[i]);
		for (const alias of aliases) {
			if (normalizeHeader(alias) === h) return i;
		}
		if (h === normalized) return i;
	}
	return -1;
}

function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if ((char === "," || char === "\t") && !inQuotes) {
			result.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	result.push(current.trim());
	return result;
}

function csvToRows(csvContent: string): string[][] {
	const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());
	return lines.map((line) => parseCSVLine(line));
}

function excelToRows(buffer: ArrayBuffer): string[][] {
	const workbook = XLSX.read(buffer, { type: "array" });
	const sheet = workbook.Sheets[workbook.SheetNames[0]];
	if (!sheet) return [];
	const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
	return json.map((row) => (Array.isArray(row) ? row.map(String) : [String(row)]));
}

// --- Partner parsing ---
export interface ParsedPartnerRow {
	name: string;
	businessName: string | null;
	email: string | null;
	phone: string | null;
	partnerType: string;
	territory: string | null;
	city: string | null;
	state: string | null;
	zip: string | null;
	tier: string;
	notes: string | null;
}

export interface PartnerParseResult {
	rows: ParsedPartnerRow[];
	errors: string[];
	warnings: string[];
}

export function parsePartnersFile(content: string | ArrayBuffer, isExcel: boolean): PartnerParseResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const rows: ParsedPartnerRow[] = [];

	let dataRows: string[][];
	if (isExcel) {
		try {
			const buffer = content instanceof ArrayBuffer ? content : (() => {
				const bytes = Uint8Array.from(atob(content as string), (c) => c.charCodeAt(0));
				return bytes.buffer;
			})();
			dataRows = excelToRows(buffer);
		} catch (e) {
			return { rows: [], errors: ["Failed to parse Excel file"], warnings: [] };
		}
	} else {
		dataRows = csvToRows(content as string);
	}

	if (dataRows.length < 2) {
		return { rows: [], errors: ["File must have a header row and at least one data row"], warnings: [] };
	}

	const headers = dataRows[0];
	const nameIdx = findColumn("name", headers, PARTNER_COLUMNS);
	if (nameIdx < 0) {
		return { rows: [], errors: ["Missing required column: Name (or Contact, Partner)"], warnings: [] };
	}

	if (dataRows.length - 1 > MAX_ROWS) {
		warnings.push(`Only first ${MAX_ROWS} rows will be imported. File has ${dataRows.length - 1} rows.`);
	}

	const businessIdx = findColumn("businessName", headers, PARTNER_COLUMNS);
	const emailIdx = findColumn("email", headers, PARTNER_COLUMNS);
	const phoneIdx = findColumn("phone", headers, PARTNER_COLUMNS);
	const typeIdx = findColumn("partnerType", headers, PARTNER_COLUMNS);
	const territoryIdx = findColumn("territory", headers, PARTNER_COLUMNS);
	const cityIdx = findColumn("city", headers, PARTNER_COLUMNS);
	const stateIdx = findColumn("state", headers, PARTNER_COLUMNS);
	const zipIdx = findColumn("zip", headers, PARTNER_COLUMNS);
	const tierIdx = findColumn("tier", headers, PARTNER_COLUMNS);
	const notesIdx = findColumn("notes", headers, PARTNER_COLUMNS);

	for (let i = 1; i < Math.min(dataRows.length, MAX_ROWS + 1); i++) {
		const values = dataRows[i];
		const name = (values[nameIdx] ?? "").trim();
		if (!name) {
			warnings.push(`Row ${i + 1}: Skipped (empty name)`);
			continue;
		}

		const rawType = (values[typeIdx] ?? "").trim().toLowerCase().replace(/\s+/g, "_");
		const partnerType = PARTNER_TYPES.includes(rawType) ? rawType : "other";

		const rawTier = (values[tierIdx] ?? "").trim().toLowerCase();
		const tier = ["bronze", "silver", "gold", "platinum"].includes(rawTier) ? rawTier : "bronze";

		rows.push({
			name,
			businessName: businessIdx >= 0 && values[businessIdx] ? String(values[businessIdx]).trim() || null : null,
			email: emailIdx >= 0 && values[emailIdx] ? String(values[emailIdx]).trim() || null : null,
			phone: phoneIdx >= 0 && values[phoneIdx] ? String(values[phoneIdx]).trim() || null : null,
			partnerType,
			territory: territoryIdx >= 0 && values[territoryIdx] ? String(values[territoryIdx]).trim() || null : null,
			city: cityIdx >= 0 && values[cityIdx] ? String(values[cityIdx]).trim() || null : null,
			state: stateIdx >= 0 && values[stateIdx] ? String(values[stateIdx]).trim() || null : null,
			zip: zipIdx >= 0 && values[zipIdx] ? String(values[zipIdx]).trim() || null : null,
			tier,
			notes: notesIdx >= 0 && values[notesIdx] ? String(values[notesIdx]).trim() || null : null,
		});
	}

	return { rows, errors, warnings };
}

// --- Referral parsing ---
export interface ParsedReferralRow {
	propertyAddress: string;
	partnerName: string | null;
	homeownerName: string | null;
	homeownerPhone: string | null;
	homeownerEmail: string | null;
	city: string | null;
	state: string | null;
	zip: string | null;
	notes: string | null;
	priority: string;
	status: string;
}

export interface ReferralParseResult {
	rows: ParsedReferralRow[];
	errors: string[];
	warnings: string[];
}

export function parseReferralsFile(content: string | ArrayBuffer, isExcel: boolean): ReferralParseResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const rows: ParsedReferralRow[] = [];

	let dataRows: string[][];
	if (isExcel) {
		try {
			const buffer = content instanceof ArrayBuffer ? content : (() => {
				const bytes = Uint8Array.from(atob(content as string), (c) => c.charCodeAt(0));
				return bytes.buffer;
			})();
			dataRows = excelToRows(buffer);
		} catch (e) {
			return { rows: [], errors: ["Failed to parse Excel file"], warnings: [] };
		}
	} else {
		dataRows = csvToRows(content as string);
	}

	if (dataRows.length < 2) {
		return { rows: [], errors: ["File must have a header row and at least one data row"], warnings: [] };
	}

	const headers = dataRows[0];
	const addrIdx = findColumn("propertyAddress", headers, REFERRAL_COLUMNS);
	if (addrIdx < 0) {
		return { rows: [], errors: ["Missing required column: Property Address (or Address, Property)"], warnings: [] };
	}

	if (dataRows.length - 1 > MAX_ROWS) {
		warnings.push(`Only first ${MAX_ROWS} rows will be imported. File has ${dataRows.length - 1} rows.`);
	}

	const partnerIdx = findColumn("partnerName", headers, REFERRAL_COLUMNS);
	const homeownerIdx = findColumn("homeownerName", headers, REFERRAL_COLUMNS);
	const phoneIdx = findColumn("homeownerPhone", headers, REFERRAL_COLUMNS);
	const emailIdx = findColumn("homeownerEmail", headers, REFERRAL_COLUMNS);
	const cityIdx = findColumn("city", headers, REFERRAL_COLUMNS);
	const stateIdx = findColumn("state", headers, REFERRAL_COLUMNS);
	const zipIdx = findColumn("zip", headers, REFERRAL_COLUMNS);
	const notesIdx = findColumn("notes", headers, REFERRAL_COLUMNS);
	const priorityIdx = findColumn("priority", headers, REFERRAL_COLUMNS);
	const statusIdx = findColumn("status", headers, REFERRAL_COLUMNS);

	for (let i = 1; i < Math.min(dataRows.length, MAX_ROWS + 1); i++) {
		const values = dataRows[i];
		const propertyAddress = (values[addrIdx] ?? "").trim();
		if (!propertyAddress || propertyAddress.length < 3) {
			warnings.push(`Row ${i + 1}: Skipped (invalid or empty property address)`);
			continue;
		}

		const rawPriority = (values[priorityIdx] ?? "").trim().toLowerCase();
		const priority = REFERRAL_PRIORITIES.includes(rawPriority) ? rawPriority : "normal";

		const rawStatus = (values[statusIdx] ?? "").trim().toLowerCase().replace(/\s+/g, "_");
		const status = REFERRAL_STATUSES.includes(rawStatus) ? rawStatus : "received";

		rows.push({
			propertyAddress,
			partnerName: partnerIdx >= 0 && values[partnerIdx] ? String(values[partnerIdx]).trim() || null : null,
			homeownerName: homeownerIdx >= 0 && values[homeownerIdx] ? String(values[homeownerIdx]).trim() || null : null,
			homeownerPhone: phoneIdx >= 0 && values[phoneIdx] ? String(values[phoneIdx]).trim() || null : null,
			homeownerEmail: emailIdx >= 0 && values[emailIdx] ? String(values[emailIdx]).trim() || null : null,
			city: cityIdx >= 0 && values[cityIdx] ? String(values[cityIdx]).trim() || null : null,
			state: stateIdx >= 0 && values[stateIdx] ? String(values[stateIdx]).trim() || null : null,
			zip: zipIdx >= 0 && values[zipIdx] ? String(values[zipIdx]).trim() || null : null,
			notes: notesIdx >= 0 && values[notesIdx] ? String(values[notesIdx]).trim() || null : null,
			priority,
			status,
		});
	}

	return { rows, errors, warnings };
}

// --- File reading helpers (for client) ---
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as ArrayBuffer);
		reader.onerror = reject;
		reader.readAsArrayBuffer(file);
	});
}

export async function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsText(file);
	});
}

// --- Templates ---
export function getPartnersTemplateCSV(): string {
	const headers = ["Name", "Business Name", "Email", "Phone", "Partner Type", "Territory", "City", "State", "ZIP", "Tier", "Notes"];
	const example = ["Sarah Johnson", "ABC Realty", "sarah@abcrealty.com", "(555) 123-4567", "realtor", "North Dallas", "Dallas", "TX", "75201", "silver", "Top performer"];
	return [headers.join(","), example.join(",")].join("\n");
}

export function getReferralsTemplateCSV(): string {
	const headers = ["Property Address", "Partner Name", "Homeowner Name", "Phone", "Email", "City", "State", "ZIP", "Notes"];
	const example = ["123 Main St", "Sarah Johnson", "John Smith", "(555) 987-6543", "john@example.com", "Dallas", "TX", "75201", "Referred after inspection"];
	return [headers.join(","), example.join(",")].join("\n");
}
