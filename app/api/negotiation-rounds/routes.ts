// app/api/negotiation-rounds/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { CreateNegotiationRoundRequest } from '@/types/budget-planning';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const budgetAdjustmentId = searchParams.get('budget_adjustment_id');

    let query = supabase
      .from('budget_negotiation_rounds')
      .select('*')
      .order('round_number', { ascending: true });

    if (budgetAdjustmentId) {
      query = query.eq('budget_adjustment_id', budgetAdjustmentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching negotiation rounds:', error);
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

    if (!profile || !['financial_manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only Financial Managers can create negotiation rounds' },
        { status: 403 }
      );
    }

    const body: CreateNegotiationRoundRequest = await request.json();

    // Get the current max round number for this budget adjustment
    const { data: existingRounds } = await supabase
      .from('budget_negotiation_rounds')
      .select('round_number')
      .eq('budget_adjustment_id', body.budget_adjustment_id)
      .order('round_number', { ascending: false })
      .limit(1);

    const nextRoundNumber = existingRounds && existingRounds.length > 0 
      ? existingRounds[0].round_number + 1 
      : 1;

    // Insert negotiation round
    const { data, error } = await supabase
      .from('budget_negotiation_rounds')
      .insert({
        budget_adjustment_id: body.budget_adjustment_id,
        round_number: nextRoundNumber,
        proposed_amount: body.proposed_amount,
        alternative_options: body.alternative_options || null,
        financial_manager_notes: body.financial_manager_notes || null,
        status: 'pending_client'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating negotiation round:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update budget adjustment status
    await supabase
      .from('budget_adjustments')
      .update({ status: 'under_review' })
      .eq('id', body.budget_adjustment_id);

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}