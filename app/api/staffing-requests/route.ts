// app/api/staffing-requests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { CreateStaffingRequestRequest } from '@/types/budget-planning';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const eventRequestId = searchParams.get('event_request_id');
    const status = searchParams.get('status');

    let query = supabase
      .from('staffing_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (eventRequestId) {
      query = query.eq('event_request_id', eventRequestId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching staffing requests:', error);
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
    const supabase = createRouteHandlerClient({ cookies });
    
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
        { error: 'Only Production or Service Managers can submit staffing requests' },
        { status: 403 }
      );
    }

    const body: CreateStaffingRequestRequest = await request.json();

    // Validate required fields
    if (!body.event_request_id || !body.required_positions || !body.conflict_details || !body.urgency_level) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Insert staffing request
    const { data, error } = await supabase
      .from('staffing_requests')
      .insert({
        budget_adjustment_id: body.budget_adjustment_id || null,
        event_request_id: body.event_request_id,
        submitted_by: session.user.id,
        submitted_by_role: profile.role,
        required_positions: body.required_positions,
        conflict_details: body.conflict_details,
        urgency_level: body.urgency_level,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating staffing request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If this is linked to a budget adjustment, update its status
    if (body.budget_adjustment_id) {
      await supabase
        .from('budget_adjustments')
        .update({ status: 'needs_staffing' })
        .eq('id', body.budget_adjustment_id);
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