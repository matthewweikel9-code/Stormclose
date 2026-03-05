import { NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

type DownloadCsvRequest = {
  reportData: JsonRecord | JsonRecord[];
};

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isValidBody(value: unknown): value is DownloadCsvRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = value as Record<string, unknown>;
  const reportData = body.reportData;

  if (Array.isArray(reportData)) {
    return reportData.every((row) => isJsonRecord(row));
  }

  return isJsonRecord(reportData);
}

function toCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function escapeCsv(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function collectHeaders(rows: JsonRecord[]): string[] {
  const ordered = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      ordered.add(key);
    }
  }

  return Array.from(ordered);
}

function rowsToCsv(rows: JsonRecord[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = collectHeaders(rows);
  const headerLine = headers.map(escapeCsv).join(",");

  const dataLines = rows.map((row) =>
    headers
      .map((header) => {
        const raw = toCellValue(row[header]);
        return escapeCsv(raw);
      })
      .join(",")
  );

  return [headerLine, ...dataLines].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidBody(body)) {
      return NextResponse.json(
        { error: "Invalid payload. Expected { reportData: object | object[] }." },
        { status: 400 }
      );
    }

    const rows = Array.isArray(body.reportData) ? body.reportData : [body.reportData];
    const csv = rowsToCsv(rows);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="claim_report.csv"'
      }
    });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}
