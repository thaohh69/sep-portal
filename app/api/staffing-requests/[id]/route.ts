// app/api/staffing-requests/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { UpdateStaffingRequestRequest } from '@/types/budget-planning';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('staffing_requests')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching staffing request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    if (!profile || !['hr_team', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only HR Team members can update staffing requests' },
        { status: 403 }
      );
    }

    const body: UpdateStaffingRequestRequest = await request.json();

    // Prepare update object
    const updateData: any = {
      status: body.status
    };

    if (body.hr_notes) {
      updateData.hr_notes = body.hr_notes;
    }

    if (body.resolution_details) {
      updateData.resolution_details = body.resolution_details;
    }

    if (body.status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    // Update staffing request
    const { data, error } = await supabase
      .from('staffing_requests')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating staffing request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If resolved and linked to a budget adjustment, update the budget adjustment status
    if (body.status === 'resolved' && data.budget_adjustment_id) {
      await supabase
        .from('budget_adjustments')
        .update({ status: 'pending' })
        .eq('id', data.budget_adjustment_id);
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