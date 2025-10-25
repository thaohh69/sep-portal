// app/api/budget-adjustments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreateBudgetAdjustmentRequest } from '@/app/types/budget-planning';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const eventRequestId = searchParams.get('event_request_id');
    const status = searchParams.get('status');

    // Build query
    let query = supabase
      .from('budget_adjustments')
      .select(`
        *,
        negotiation_rounds:budget_negotiation_rounds(*),
        staffing_requests:staffing_requests(*)
      `)
      .order('created_at', { ascending: false });

    if (eventRequestId) {
      query = query.eq('event_request_id', eventRequestId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching budget adjustments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to verify role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile || !['production_manager', 'service_manager'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only Production or Service Managers can submit budget adjustments' },
        { status: 403 }
      );
    }

    const body: CreateBudgetAdjustmentRequest = await request.json();

    // Validate required fields
    if (!body.event_request_id || !body.resource_requirements || !body.justification) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate estimated cost
    const estimated_cost = body.resource_requirements.reduce(
      (sum, req) => sum + req.totalCost,
      0
    );

    // Insert budget adjustment
    const { data, error } = await supabase
      .from('budget_adjustments')
      .insert({
        event_request_id: body.event_request_id,
        submitted_by: session.user.id,
        submitted_by_role: profile.role,
        resource_requirements: body.resource_requirements,
        estimated_cost,
        justification: body.justification,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating budget adjustment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}