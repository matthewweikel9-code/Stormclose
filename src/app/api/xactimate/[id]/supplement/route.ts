import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkFeatureAccess } from '@/lib/subscriptions/access';

// POST /api/xactimate/[id]/supplement - Generate supplement document
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const estimateId = params.id;

    // Fetch the estimate with analysis
    const { data: estimate, error: fetchError } = await (supabase as any)
      .from('xactimate_estimates')
      .select('*')
      .eq('id', estimateId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    if (!estimate.ai_analysis) {
      return NextResponse.json({ error: 'Estimate must be analyzed first' }, { status: 400 });
    }

    // Generate supplement document content
    const supplementContent = generateSupplementDocument(estimate);

    // Store the supplement
    const supplementKey = `supplements/${user.id}/${estimateId}_supplement_${Date.now()}.txt`;
    
    const { error: uploadError } = await supabase.storage
      .from('estimates')
      .upload(supplementKey, supplementContent, {
        contentType: 'text/plain',
      });

    if (uploadError) {
      console.warn('Failed to store supplement:', uploadError);
    }

    // Update estimate status
    await (supabase as any)
      .from('xactimate_estimates')
      .update({
        status: 'supplemented',
        supplement_generated_at: new Date().toISOString(),
      })
      .eq('id', estimateId);

    // For now, return the content as a downloadable blob URL
    // In production, this would generate a proper PDF
    const blob = new Blob([supplementContent], { type: 'text/plain' });
    
    // Create a data URL for download
    const dataUrl = `data:text/plain;base64,${Buffer.from(supplementContent).toString('base64')}`;

    return NextResponse.json({ 
      downloadUrl: dataUrl,
      fileName: `supplement_${estimate.claim_number || estimateId}.txt`,
      content: supplementContent,
    });
  } catch (error) {
    console.error('Supplement generation error:', error);
    return NextResponse.json({ error: 'Failed to generate supplement' }, { status: 500 });
  }
}

function generateSupplementDocument(estimate: any): string {
  const analysis = estimate.ai_analysis;
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let content = `
================================================================================
                        SUPPLEMENT REQUEST DOCUMENT
================================================================================

Date: ${date}
Claim Number: ${estimate.claim_number || 'N/A'}
Property Address: ${estimate.property_address}
Insurance Carrier: ${estimate.insurance_carrier}
${estimate.adjuster_name ? `Adjuster: ${estimate.adjuster_name}` : ''}
${estimate.adjuster_email ? `Adjuster Email: ${estimate.adjuster_email}` : ''}

--------------------------------------------------------------------------------
                           ORIGINAL ESTIMATE SUMMARY
--------------------------------------------------------------------------------

Replacement Cost Value (RCV): $${estimate.original_rcv?.toLocaleString() || '0'}
Actual Cash Value (ACV): $${estimate.original_acv?.toLocaleString() || '0'}
Depreciation: $${estimate.depreciation?.toLocaleString() || '0'}
Deductible: $${estimate.deductible?.toLocaleString() || '0'}

================================================================================
                        SUPPLEMENTAL ITEMS REQUEST
================================================================================

${analysis.summary}

--------------------------------------------------------------------------------
                           MISSING LINE ITEMS
--------------------------------------------------------------------------------

`;

  analysis.missing_items.forEach((item: any, index: number) => {
    content += `
${index + 1}. ${item.item}
   Category: ${item.category}
   Xactimate Code: ${item.xactimate_code}
   Estimated Value: $${item.estimated_value.toLocaleString()}
   
   Justification:
   ${item.justification}
   
   Confidence Level: ${Math.round(item.confidence * 100)}%
   
--------------------------------------------------------------------------------
`;
  });

  content += `
================================================================================
                           SUPPLEMENT SUMMARY
================================================================================

Total Number of Missing Items: ${analysis.missing_items.length}
Total Supplement Amount Requested: $${analysis.suggested_supplement.toLocaleString()}

--------------------------------------------------------------------------------
                           SUPPORTING DOCUMENTATION
--------------------------------------------------------------------------------

The following items were identified through detailed inspection and review of 
the original Xactimate estimate. Each item represents necessary repairs or 
replacements that were not included in the initial scope of work.

These supplemental items are consistent with:
- Industry standard repair practices
- Local building code requirements
- Manufacturer installation specifications
- OSHA safety compliance requirements

We respectfully request a review and approval of these additional line items 
to ensure the property is restored to its pre-loss condition.

--------------------------------------------------------------------------------
                           CONTACT INFORMATION
--------------------------------------------------------------------------------

Please contact us at your earliest convenience to discuss this supplement 
request. We are prepared to provide additional documentation, photographs, 
or on-site meetings as needed to support these supplemental items.

================================================================================
               This document was generated using AI-assisted analysis
                    for accuracy verification, please review all items
================================================================================
`;

  return content;
}
