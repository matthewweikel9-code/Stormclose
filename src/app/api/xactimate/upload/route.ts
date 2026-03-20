import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkFeatureAccess } from '@/lib/subscriptions/access';

// POST /api/xactimate/upload - Handle file uploads
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await checkFeatureAccess(user.id, 'supplement_generator');
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason ?? 'Supplement Generator requires a higher subscription tier.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validExtensions = ['.esx', '.pdf', '.xml'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload .esx, .pdf, or .xml files' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileContent);

    // Parse estimate data based on file type
    let estimateData = await parseEstimateFile(fileName, fileBuffer);

    // Upload file to storage (optional - for keeping records)
    const fileKey = `xactimate/${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('estimates')
      .upload(fileKey, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
      });

    if (uploadError) {
      console.warn('Failed to upload to storage:', uploadError);
      // Continue without file storage - not critical
    }

    // Create estimate record
    const { data: estimate, error } = await (supabase as any)
      .from('xactimate_estimates')
      .insert({
        user_id: user.id,
        file_path: uploadError ? null : fileKey,
        file_name: file.name,
        ...estimateData,
        status: 'uploaded',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating estimate:', error);
      return NextResponse.json({ error: 'Failed to save estimate' }, { status: 500 });
    }

    return NextResponse.json({ estimate });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 });
  }
}

// Parse estimate file based on type
async function parseEstimateFile(
  fileName: string,
  buffer: Buffer
): Promise<{
  claim_number?: string;
  property_address: string;
  insurance_carrier: string;
  adjuster_name?: string;
  adjuster_email?: string;
  original_rcv: number;
  original_acv: number;
  depreciation: number;
  deductible: number;
  raw_data?: any;
}> {
  // For MVP, we'll extract basic data
  // In production, this would integrate with Xactimate's API or use OCR for PDFs

  if (fileName.endsWith('.xml')) {
    return parseXMLEstimate(buffer);
  } else if (fileName.endsWith('.pdf')) {
    return parsePDFEstimate(buffer);
  } else if (fileName.endsWith('.esx')) {
    return parseESXEstimate(buffer);
  }

  // Default placeholder
  return {
    property_address: 'Unknown Address (manual entry required)',
    insurance_carrier: 'Unknown Carrier',
    original_rcv: 0,
    original_acv: 0,
    depreciation: 0,
    deductible: 0,
  };
}

// Parse XML Xactimate export
function parseXMLEstimate(buffer: Buffer): {
  claim_number?: string;
  property_address: string;
  insurance_carrier: string;
  adjuster_name?: string;
  original_rcv: number;
  original_acv: number;
  depreciation: number;
  deductible: number;
  raw_data?: any;
} {
  try {
    const content = buffer.toString('utf-8');
    
    // Basic XML parsing for common Xactimate export fields
    const extractValue = (tag: string): string | undefined => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1].trim() : undefined;
    };

    const extractNumber = (tag: string): number => {
      const value = extractValue(tag);
      return value ? parseFloat(value.replace(/[^0-9.-]/g, '')) || 0 : 0;
    };

    // Try to extract common fields
    const address = extractValue('PropertyAddress') || 
                   extractValue('Address') || 
                   extractValue('InsuredAddress') ||
                   'Address from XML';
    
    const carrier = extractValue('InsuranceCompany') || 
                   extractValue('Carrier') || 
                   extractValue('InsuranceName') ||
                   'Carrier from XML';

    return {
      claim_number: extractValue('ClaimNumber') || extractValue('PolicyNumber'),
      property_address: address,
      insurance_carrier: carrier,
      adjuster_name: extractValue('AdjusterName') || extractValue('Adjuster'),
      original_rcv: extractNumber('RCV') || extractNumber('ReplacementCostValue') || extractNumber('TotalRCV'),
      original_acv: extractNumber('ACV') || extractNumber('ActualCashValue') || extractNumber('TotalACV'),
      depreciation: extractNumber('Depreciation') || extractNumber('TotalDepreciation'),
      deductible: extractNumber('Deductible'),
      raw_data: { parsed: true, fileType: 'xml' },
    };
  } catch (error) {
    console.error('XML parsing error:', error);
    return {
      property_address: 'Failed to parse XML',
      insurance_carrier: 'Unknown',
      original_rcv: 0,
      original_acv: 0,
      depreciation: 0,
      deductible: 0,
    };
  }
}

// Parse PDF estimate (would use OCR in production)
function parsePDFEstimate(buffer: Buffer): {
  claim_number?: string;
  property_address: string;
  insurance_carrier: string;
  original_rcv: number;
  original_acv: number;
  depreciation: number;
  deductible: number;
} {
  // In production, this would use pdf-parse or similar + OCR
  // For now, return placeholder data that requires manual entry
  return {
    property_address: 'PDF uploaded - click to enter details',
    insurance_carrier: 'Manual entry required',
    original_rcv: 0,
    original_acv: 0,
    depreciation: 0,
    deductible: 0,
  };
}

// Parse ESX (Xactimate native format)
function parseESXEstimate(buffer: Buffer): {
  claim_number?: string;
  property_address: string;
  insurance_carrier: string;
  original_rcv: number;
  original_acv: number;
  depreciation: number;
  deductible: number;
} {
  // ESX files are proprietary - would need Xactimate SDK or API
  // For now, return placeholder
  return {
    property_address: 'ESX file uploaded - processing...',
    insurance_carrier: 'Xactimate',
    original_rcv: 0,
    original_acv: 0,
    depreciation: 0,
    deductible: 0,
  };
}
