import { NextRequest, NextResponse } from 'next/server';
import { subscribeProgress } from '@/server/textWorkerProgress';

const encoder = new TextEncoder();

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('run');
  if (!runId || runId.trim().length === 0) {
    return NextResponse.json(
      { error: 'Missing run query parameter' },
      { status: 400 },
    );
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const writeEvent = async (event: unknown) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    await writer.write(encoder.encode(payload));
  };

  const unsubscribe = subscribeProgress(runId, (event) => {
    void writeEvent(event);
  });

  const keepAlive = setInterval(() => {
    void writer.write(encoder.encode(':\n\n'));
  }, 15000);

  const close = async () => {
    clearInterval(keepAlive);
    unsubscribe();
    try {
      await writer.close();
    } catch (error) {
      console.warn('[TextWorkerProgress] Failed to close writer:', error);
    }
  };

  req.signal?.addEventListener('abort', () => {
    void close();
  });

  await writeEvent({
    type: 'status',
    label: 'connected',
    message: 'Progress stream connected (embed)',
    timestamp: new Date().toISOString(),
  });

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
