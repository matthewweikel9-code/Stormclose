// CSV Parser for JobNimbus/Xactimate format

export interface ParsedCSVRow {
	propertyAddress: string;
	roofType: string;
	shingleType: string;
	damageNotes: string;
	insuranceCompany: string;
	slopesDamaged: number;
	customerName?: string;
	claimNumber?: string;
	inspectionDate?: string;
	adjusterName?: string;
	adjusterEmail?: string;
	policyNumber?: string;
	rawData: Record<string, string>;
}

export interface CSVParseResult {
	success: boolean;
	data: ParsedCSVRow[];
	errors: string[];
	warnings: string[];
}

// Column name mappings for different CSV formats
const COLUMN_MAPPINGS: Record<string, string[]> = {
	propertyAddress: [
		"property_address",
		"propertyaddress",
		"address",
		"property address",
		"location",
		"site address",
		"job address"
	],
	roofType: ["roof_type", "rooftype", "roof type", "roofing type", "material"],
	shingleType: [
		"shingle_type",
		"shingletype",
		"shingle type",
		"shingle",
		"shingle material",
		"roofing material"
	],
	damageNotes: [
		"damage_notes",
		"damagenotes",
		"damage notes",
		"notes",
		"damage description",
		"description",
		"damage",
		"comments"
	],
	insuranceCompany: [
		"insurance_company",
		"insurancecompany",
		"insurance company",
		"insurance",
		"carrier",
		"insurance carrier",
		"ins company"
	],
	slopesDamaged: [
		"slopes_damaged",
		"slopesdamaged",
		"slopes damaged",
		"slopes",
		"damaged slopes",
		"num slopes",
		"number of slopes"
	],
	customerName: [
		"customer_name",
		"customername",
		"customer name",
		"customer",
		"homeowner",
		"owner",
		"name",
		"client"
	],
	claimNumber: [
		"claim_number",
		"claimnumber",
		"claim number",
		"claim",
		"claim #",
		"claim no"
	],
	inspectionDate: [
		"inspection_date",
		"inspectiondate",
		"inspection date",
		"date",
		"inspection",
		"date of inspection"
	],
	adjusterName: [
		"adjuster_name",
		"adjustername",
		"adjuster name",
		"adjuster",
		"claims adjuster"
	],
	adjusterEmail: [
		"adjuster_email",
		"adjusteremail",
		"adjuster email",
		"adjuster_email_address"
	],
	policyNumber: [
		"policy_number",
		"policynumber",
		"policy number",
		"policy",
		"policy #",
		"policy no"
	]
};

function normalizeHeader(header: string): string {
	return header.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function findColumnMapping(header: string): string | null {
	const normalized = normalizeHeader(header);

	for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
		for (const alias of aliases) {
			if (normalizeHeader(alias) === normalized) {
				return field;
			}
		}
	}

	return null;
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
		} else if (char === "," && !inQuotes) {
			result.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}

	result.push(current.trim());
	return result;
}

export function parseCSV(csvContent: string): CSVParseResult {
	const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());
	const errors: string[] = [];
	const warnings: string[] = [];
	const data: ParsedCSVRow[] = [];

	if (lines.length < 2) {
		return {
			success: false,
			data: [],
			errors: ["CSV file must have at least a header row and one data row"],
			warnings: []
		};
	}

	// Parse header row
	const headers = parseCSVLine(lines[0]);
	const columnMap: Record<number, string> = {};

	headers.forEach((header, index) => {
		const mapping = findColumnMapping(header);
		if (mapping) {
			columnMap[index] = mapping;
		} else {
			warnings.push(`Unknown column: "${header}" (will be stored in rawData)`);
		}
	});

	// Check for required columns
	const mappedFields = Object.values(columnMap);
	const requiredFields = ["propertyAddress", "damageNotes"];
	const missingRequired = requiredFields.filter((f) => !mappedFields.includes(f));

	if (missingRequired.length > 0) {
		errors.push(`Missing required columns: ${missingRequired.join(", ")}`);
	}

	// Parse data rows
	for (let i = 1; i < lines.length; i++) {
		const values = parseCSVLine(lines[i]);

		if (values.length === 0 || (values.length === 1 && !values[0])) {
			continue; // Skip empty rows
		}

		const rawData: Record<string, string> = {};
		const row: Partial<ParsedCSVRow> = {};

		values.forEach((value, index) => {
			const field = columnMap[index];
			const headerName = headers[index] || `column_${index}`;

			rawData[headerName] = value;

			if (field) {
				if (field === "slopesDamaged") {
					const num = parseInt(value, 10);
					(row as Record<string, unknown>)[field] = isNaN(num) ? 0 : num;
				} else {
					(row as Record<string, unknown>)[field] = value;
				}
			}
		});

		// Validate row
		if (!row.propertyAddress && !row.damageNotes) {
			warnings.push(`Row ${i + 1}: Missing property address and damage notes, skipping`);
			continue;
		}

		data.push({
			propertyAddress: row.propertyAddress || "",
			roofType: row.roofType || "Unknown",
			shingleType: row.shingleType || "Unknown",
			damageNotes: row.damageNotes || "",
			insuranceCompany: row.insuranceCompany || "Unknown",
			slopesDamaged: row.slopesDamaged || 0,
			customerName: row.customerName,
			claimNumber: row.claimNumber,
			inspectionDate: row.inspectionDate,
			adjusterName: row.adjusterName,
			adjusterEmail: row.adjusterEmail,
			policyNumber: row.policyNumber,
			rawData
		});
	}

	return {
		success: errors.length === 0 && data.length > 0,
		data,
		errors,
		warnings
	};
}

export function generateCSVTemplate(): string {
	const headers = [
		"Property Address",
		"Roof Type",
		"Shingle Type",
		"Damage Notes",
		"Insurance Company",
		"Slopes Damaged",
		"Customer Name",
		"Claim Number",
		"Inspection Date",
		"Adjuster Name",
		"Adjuster Email",
		"Policy Number"
	];

	const exampleRow = [
		"123 Main St, Austin TX 78701",
		"Asphalt Shingle",
		"3-Tab",
		"Hail damage on north and east slopes. Multiple cracked and missing shingles.",
		"State Farm",
		"4",
		"John Smith",
		"CLM-2024-12345",
		"2024-03-01",
		"Jane Doe",
		"jane.doe@statefarm.com",
		"POL-987654"
	];

	return [headers.join(","), exampleRow.join(",")].join("\n");
}
