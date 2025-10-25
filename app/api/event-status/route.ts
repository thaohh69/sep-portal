// app/api/event-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { UpdateEventStatusRequest } from '@/types/budget-planning';

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

    if (!profile || !['production_manager', 'service_manager', 'financial_manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update event status' },
        { status: 403 }
      );
    }

    const body: UpdateEventStatusRequest = await request.json();

    // Validate required fields
    if (!body.event_request_id || !body.new_status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current event status (assuming you have an event_requests table)
    const { data: eventRequest } = await supabase
      .from('event_requests')
      .select('status')
      .eq('id', body.event_request_id)
      .single();

    const previousStatus = eventRequest?.status;

    // Insert status history record
    const { data: historyData, error: historyError } = await supabase
      .from('event_request_status_history')
      .insert({
        event_request_id: body.event_request_id,
        previous_status: previousStatus,
        new_status: body.new_status,
        changed_by: session.user.id,
        change_reason: body.change_reason || null,
        metadata: body.metadata || null
      })
      .select()
      .single();

    if (historyError) {
      console.error('Error creating status history:', historyError);
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    // Update event request status
    const { data: updatedEvent, error: updateError } = await supabase
      .from('event_requests')
      .update({ status: body.new_status })
      .eq('id', body.event_request_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating event status:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      data: updatedEvent,
      history: historyData 
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get status history for an event
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const eventRequestId = searchParams.get('event_request_id');

    if (!eventRequestId) {
      return NextResponse.json(
        { error: 'event_request_id is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('event_request_status_history')
      .select('*')
      .eq('event_request_id', eventRequestId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching status history:', error);
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