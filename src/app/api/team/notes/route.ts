import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveWriteTeamIdForUser } from '@/lib/server/tenant';

// GET: List team notes
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
    if (!teamId) {
      return NextResponse.json({ notes: [] });
    }

    const { data, error } = await (supabase.from('team_notes') as any)
      .select('id, content, user_id, created_at, updated_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Team notes fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    const userIds = [...new Set((data || []).map((n: any) => n.user_id))];
    const { data: users } = await (supabase.from('users') as any)
      .select('id, email')
      .in('id', userIds);
    const userById = new Map((users ?? []).map((u: any) => [u.id, u.email?.split('@')[0] || 'Team Member']));

    const notes = (data || []).map((n: any) => ({
      ...n,
      user_name: userById.get(n.user_id) || 'Team Member',
      is_mine: n.user_id === user.id,
    }));

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Team notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a note
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
    if (!teamId) {
      return NextResponse.json({ error: 'Create a team first' }, { status: 400 });
    }

    const { content } = await request.json();
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const { data, error } = await (supabase.from('team_notes') as any)
      .insert({
        team_id: teamId,
        user_id: user.id,
        content: content.trim().slice(0, 5000),
      })
      .select()
      .single();

    if (error) {
      console.error('Team note create error:', error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json({ note: { ...data, user_name: user.email?.split('@')[0] || 'You' } });
  } catch (error) {
    console.error('Team note error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete a note
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Note ID required' }, { status: 400 });
    }

    const { error } = await (supabase.from('team_notes') as any)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Team note delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
