import assert from 'node:assert/strict';
import { test } from 'node:test';
const { SwarmClient } = await import(process.env.CLIENT_MODULE || './fixed/index.js');
function clientFor(frame, fragment = false) {
  const bytes = new TextEncoder().encode(frame);
  return new SwarmClient({ endpoint: 'https://fixture.invalid', token: 'fixture', fetch: async () => new Response(new ReadableStream({
    start(stream) {
      if (fragment) for (const byte of bytes) stream.enqueue(Uint8Array.of(byte));
      else stream.enqueue(bytes);
      stream.close();
    }
  }), { headers: { 'content-type': 'text/event-stream' } }) });
}
for (const ending of ['\n', '\r\n']) for (const fragment of [false,true]) {
  test(`empty event defaults to message: ${JSON.stringify(ending)}, fragmented=${fragment}`, async () => {
    const events=[];
    for await (const e of clientFor(`id: 7${ending}event:${ending}data: {"seq":7}${ending}${ending}`,fragment).watch('fixture')) events.push(e);
    assert.deepEqual(events,[{id:'7',event:'message',data:{seq:7}}]);
  });
}
test('named event is unchanged', async () => {
  const events=[];
  for await(const e of clientFor('event: log\ndata: {}\n\n').watch('fixture')) events.push(e);
  assert.equal(events[0].event,'log');
});
test('empty event resets a previously named event in the same frame', async () => {
  const events=[];
  for await(const e of clientFor('event: log\nevent:\ndata: {}\n\n').watch('fixture')) events.push(e);
  assert.equal(events[0].event,'message');
});
test('no event field is unchanged', async () => {
  const events=[];
  for await(const e of clientFor('data: {}\n\n').watch('fixture')) events.push(e);
  assert.equal(events[0].event,'message');
});
