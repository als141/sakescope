import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

const PING_INTERVAL_MS = 15000;
const POLL_INTERVAL_MS = 5000;

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (payload: unknown) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  const close = async () => {
    clearInterval(pollTimer);
    clearInterval(pingTimer);
    try {
      await writer.close();
    } catch (error) {
      console.warn('[GiftJobEvents] Failed to close writer', error);
    }
  };

  const jobResult = await supabase
    .from('gift_jobs')
    .select('status')
    .eq('id', jobId)
    .maybeSingle();

  if (jobResult.error || !jobResult.data) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  await send({
    type: 'status',
    label: 'connected',
    message: 'ギフトジョブの進捗ストリームに接続しました。',
    timestamp: new Date().toISOString(),
  });

  let cursor = req.nextUrl.searchParams.get('since') ?? null;
  let terminalSent = false;

  const fetchAndEmit = async () => {
    const eventsQuery = supabase
      .from('gift_job_events')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    if (cursor) {
      eventsQuery.gt('created_at', cursor);
    }
    const { data: events, error: eventsError } = await eventsQuery;
    if (eventsError) {
      await send({
        type: 'error',
        label: 'event_fetch_failed',
        message: eventsError.message,
        timestamp: new Date().toISOString(),
      });
    } else if (events && events.length > 0) {
      for (const event of events) {
        await send({
          type: event.event_type,
          label: event.label,
          message: event.message,
          payload: event.payload,
          timestamp: event.created_at,
        });
      }
      cursor = events[events.length - 1].created_at;
    }

    const { data: jobState, error: jobError } = await supabase
      .from('gift_jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    if (!jobError && jobState && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(jobState.status)) {
      if (!terminalSent) {
        await send({
          type: 'terminal',
          label: jobState.status,
          message: 'ジョブは終了状態です。',
          timestamp: new Date().toISOString(),
        });
        terminalSent = true;
      }
      await close();
    }
  };

  await fetchAndEmit();
  const pollTimer = setInterval(() => {
    void fetchAndEmit();
  }, POLL_INTERVAL_MS);

  const pingTimer = setInterval(() => {
    void writer.write(encoder.encode(':\n\n'));
  }, PING_INTERVAL_MS);

  req.signal?.addEventListener('abort', () => {
    void close();
  });

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
