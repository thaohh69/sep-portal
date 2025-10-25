// app/api/negotiation-rounds/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { UpdateNegotiationRoundRequest } from '@/types/budget-planning';

interface RouteParams {
  params: {
    id: string;
  };
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

    if (!profile || !['financial_manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only Financial Managers can update negotiation rounds' },
        { status: 403 }
      );
    }

    const body: UpdateNegotiationRoundRequest = await request.json();

    // Update negotiation round
    const { data, error } = await supabase
      .from('budget_negotiation_rounds')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating negotiation round:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If status is accepted, update budget adjustment to approved
    if (body.status === 'accepted') {
      await supabase
        .from('budget_adjustments')
        .update({ status: 'approved' })
        .eq('id', data.budget_adjustment_id);
    }

    // If status is rejected and this is a final rejection
    if (body.status === 'rejected') {
      // Check if we should mark the budget adjustment as rejected
      const searchParams = request.nextUrl.searchParams;
      const isFinalRejection = searchParams.get('final_rejection') === 'true';
      
      if (isFinalRejection) {
        await supabase
          .from('budget_adjustments')
          .update({ status: 'rejected' })
          .eq('id', data.budget_adjustment_id);
      }
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