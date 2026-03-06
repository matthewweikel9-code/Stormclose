import jsPDF from "jspdf";

export interface ReportPDFData {
	companyName: string;
	customerName: string;
	propertyAddress: string;
	reportContent: string;
	generatedAt: Date;
	reportType?: "insurance" | "estimate" | "inspection";
}

function parseMarkdownToPDF(doc: jsPDF, content: string, startY: number, pageWidth: number, margins: { left: number; right: number }): number {
	const contentWidth = pageWidth - margins.left - margins.right;
	let y = startY;
	const lineHeight = 6;
	const paragraphSpacing = 4;
	const headerSpacing = 8;
	
	const lines = content.split("\n");
	
	for (const line of lines) {
		// Check if we need a new page
		if (y > 270) {
			doc.addPage();
			y = 20;
		}

		const trimmedLine = line.trim();
		
		// Skip empty lines but add spacing
		if (!trimmedLine) {
			y += paragraphSpacing;
			continue;
		}

		// Handle headers
		if (trimmedLine.startsWith("### ")) {
			y += headerSpacing / 2;
			doc.setFontSize(12);
			doc.setFont("helvetica", "bold");
			doc.text(trimmedLine.replace("### ", ""), margins.left, y);
			y += lineHeight + 2;
			doc.setFont("helvetica", "normal");
			continue;
		}
		
		if (trimmedLine.startsWith("## ")) {
			y += headerSpacing;
			doc.setFontSize(14);
			doc.setFont("helvetica", "bold");
			doc.text(trimmedLine.replace("## ", ""), margins.left, y);
			y += lineHeight + 4;
			doc.setFont("helvetica", "normal");
			continue;
		}
		
		if (trimmedLine.startsWith("# ")) {
			y += headerSpacing;
			doc.setFontSize(16);
			doc.setFont("helvetica", "bold");
			doc.text(trimmedLine.replace("# ", ""), margins.left, y);
			y += lineHeight + 6;
			doc.setFont("helvetica", "normal");
			continue;
		}

		// Handle bold text
		let processedLine = trimmedLine;
		const boldPattern = /\*\*(.*?)\*\*/g;
		processedLine = processedLine.replace(boldPattern, "$1");

		// Handle list items
		let indent = margins.left;
		if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("• ")) {
			doc.setFontSize(10);
			doc.text("•", margins.left, y);
			indent = margins.left + 5;
			processedLine = processedLine.replace(/^[-•]\s*/, "");
		} else if (/^\d+\.\s/.test(trimmedLine)) {
			doc.setFontSize(10);
			const numMatch = trimmedLine.match(/^(\d+\.)\s/);
			if (numMatch) {
				doc.text(numMatch[1], margins.left, y);
				indent = margins.left + 8;
				processedLine = processedLine.replace(/^\d+\.\s*/, "");
			}
		} else {
			doc.setFontSize(10);
		}

		// Word wrap the text
		const words = processedLine.split(" ");
		let currentLine = "";
		const wrappedLines: string[] = [];
		
		for (const word of words) {
			const testLine = currentLine ? `${currentLine} ${word}` : word;
			const testWidth = doc.getTextWidth(testLine);
			
			if (testWidth > contentWidth - (indent - margins.left) && currentLine) {
				wrappedLines.push(currentLine);
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}
		if (currentLine) {
			wrappedLines.push(currentLine);
		}

		// Output wrapped lines
		for (const wrappedLine of wrappedLines) {
			if (y > 270) {
				doc.addPage();
				y = 20;
			}
			doc.text(wrappedLine, indent, y);
			y += lineHeight;
		}
	}
	
	return y;
}

export function generateReportPDF(data: ReportPDFData): jsPDF {
	const doc = new jsPDF({
		orientation: "portrait",
		unit: "mm",
		format: "letter"
	});

	const pageWidth = doc.internal.pageSize.getWidth();
	const margins = { left: 20, right: 20 };
	
	// Header with company branding
	doc.setFillColor(30, 58, 138); // Blue
	doc.rect(0, 0, pageWidth, 35, "F");
	
	// Company name
	doc.setTextColor(255, 255, 255);
	doc.setFontSize(24);
	doc.setFont("helvetica", "bold");
	doc.text(data.companyName, margins.left, 18);
	
	// Report type subtitle
	doc.setFontSize(12);
	doc.setFont("helvetica", "normal");
	const reportTypeLabel = data.reportType === "estimate" 
		? "Roof Estimate Report" 
		: data.reportType === "inspection" 
			? "Roof Inspection Report"
			: "Insurance Damage Assessment";
	doc.text(reportTypeLabel, margins.left, 28);
	
	// Reset text color
	doc.setTextColor(0, 0, 0);
	
	// Property Info Box
	let y = 45;
	doc.setFillColor(248, 250, 252); // Light gray
	doc.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, 28, 3, 3, "F");
	
	y += 8;
	doc.setFontSize(10);
	doc.setFont("helvetica", "bold");
	doc.text("PROPERTY OWNER", margins.left + 5, y);
	doc.text("PROPERTY ADDRESS", margins.left + 70, y);
	
	y += 6;
	doc.setFont("helvetica", "normal");
	doc.text(data.customerName, margins.left + 5, y);
	
	// Handle long addresses
	const addressWidth = pageWidth - margins.left - margins.right - 75;
	const addressLines = doc.splitTextToSize(data.propertyAddress, addressWidth);
	doc.text(addressLines, margins.left + 70, y);
	
	y += 8;
	doc.setFontSize(9);
	doc.setTextColor(100, 100, 100);
	doc.text(`Report Generated: ${data.generatedAt.toLocaleDateString("en-US", { 
		year: "numeric", 
		month: "long", 
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	})}`, margins.left + 5, y);
	doc.setTextColor(0, 0, 0);
	
	// Divider line
	y += 10;
	doc.setDrawColor(200, 200, 200);
	doc.setLineWidth(0.5);
	doc.line(margins.left, y, pageWidth - margins.right, y);
	y += 10;
	
	// Parse and render the report content
	y = parseMarkdownToPDF(doc, data.reportContent, y, pageWidth, margins);
	
	// Footer on each page
	const pageCount = doc.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.setFontSize(8);
		doc.setTextColor(128, 128, 128);
		doc.text(
			`Page ${i} of ${pageCount}`,
			pageWidth / 2,
			285,
			{ align: "center" }
		);
		doc.text(
			`${data.companyName} | Confidential`,
			margins.left,
			285
		);
		doc.text(
			new Date().toLocaleDateString(),
			pageWidth - margins.right,
			285,
			{ align: "right" }
		);
	}
	
	return doc;
}

export function downloadReportPDF(data: ReportPDFData, filename?: string): void {
	const doc = generateReportPDF(data);
	const defaultFilename = `${data.customerName.replace(/\s+/g, "_")}_Report_${data.generatedAt.toISOString().split("T")[0]}.pdf`;
	doc.save(filename || defaultFilename);
}
