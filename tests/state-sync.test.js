/**
 * state-sync — versioned state from a transport the object does not own.
 *
 * The library had no test at all, so the behaviour these pin — a batch landing
 * whole or not at all, a straggler never overwriting newer state — was
 * unverified when `ingest` opened it to consumers whose data arrives from
 * somewhere other than a socket this object opens.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createStateSync } from '../core/state-sync.js'

describe('applying a message from an external transport', () => {
  it('takes a snapshot without needing a socket', () => {
    const sync = createStateSync()
    assert.equal(sync.ingest({ method: 'snapshot', params: { v: 3, state: { tabs: { a: { title: 'A' } } } } }), 'applied')
    assert.equal(sync.get('tabs/a/title'), 'A')
    assert.equal(sync.version, 3)
  })

  it('notifies a subscriber once per batch, not once per operation', () => {
    const sync = createStateSync()
    sync.ingest({ method: 'snapshot', params: { v: 1, state: { tabs: { a: {}, b: {} } } } })

    // Subscribing delivers the current value straight away; that delivery is not
    // what this test is about, so counting starts after it.
    let calls = 0
    let seenTitle = null
    sync.on('tabs', (tabs) => { calls++; seenTitle = tabs.a.title })
    calls = 0
    seenTitle = null

    sync.ingest({ method: 'patch', params: { v: 2, ops: [
      { op: 'set', path: 'tabs/a', value: { title: 'Renamed' } },
      { op: 'set', path: 'tabs/b', value: { title: 'Other' } },
    ] } })

    assert.equal(calls, 1, 'two ops in one batch caused two renders — the point of batching is lost')
    assert.equal(seenTitle, 'Renamed', 'the listener saw state from before the batch landed')
    assert.equal(sync.get('tabs/b/title'), 'Other', 'the second op did not land')
  })

  it('leaves state untouched when one op in the batch is malformed', () => {
    const sync = createStateSync()
    sync.ingest({ method: 'snapshot', params: { v: 1, state: { tabs: { a: { title: 'A' } } } } })

    const verdict = sync.ingest({ method: 'patch', params: { v: 2, ops: [
      { op: 'set', path: 'tabs/a', value: { title: 'Renamed' } },
      { op: 'set', value: { title: 'No path' } },
    ] } })

    assert.equal(verdict, 'ignored')
    assert.equal(sync.get('tabs/a/title'), 'A',
      'the first op landed and the second failed — a half-applied batch is what versioning exists to prevent')
    assert.equal(sync.version, 1, 'the version advanced for a batch that was never applied')
  })

  it('ignores a batch that is already held rather than overwriting it', () => {
    const sync = createStateSync()
    sync.ingest({ method: 'snapshot', params: { v: 5, state: { title: 'newer' } } })
    const verdict = sync.ingest({ method: 'patch', params: { v: 4, ops: [{ op: 'set', path: 'title', value: 'older' }] } })

    assert.equal(verdict, 'ignored')
    assert.equal(sync.get('title'), 'newer', 'a straggler from a reconnect rolled the state back')
  })

  it('reports a gap instead of patching across a version it never received', () => {
    const sync = createStateSync()
    sync.ingest({ method: 'snapshot', params: { v: 1, state: { title: 'one' } } })
    const verdict = sync.ingest({ method: 'patch', params: { v: 3, base: 2, ops: [{ op: 'set', path: 'title', value: 'three' }] } })

    assert.equal(verdict, 'gap')
    assert.equal(sync.get('title'), 'one', 'a batch built on a missing version was applied anyway')
  })

  it('takes a snapshot that steps the version backwards, since a full state is authoritative', () => {
    // A restarted server starts its versions again. The snapshot is the whole
    // truth, so refusing it would leave the consumer holding the old one.
    const sync = createStateSync()
    sync.ingest({ method: 'snapshot', params: { v: 9, state: { title: 'before restart' } } })
    assert.equal(sync.ingest({ method: 'snapshot', params: { v: 1, state: { title: 'after restart' } } }), 'applied')
    assert.equal(sync.get('title'), 'after restart')
  })

  it('merges without dropping what it already had', () => {
    const sync = createStateSync()
    sync.ingest({ method: 'snapshot', params: { v: 1, state: { chats: { c1: { id: 'c1', name: 'Chat' } } } } })
    sync.ingest({ method: 'patch', params: { v: 2, ops: [{ op: 'merge', path: 'chats/c1', value: { pending: true } }] } })
    assert.deepEqual(sync.get('chats/c1'), { id: 'c1', name: 'Chat', pending: true })
  })

  it('deletes what a delete op names', () => {
    const sync = createStateSync()
    sync.ingest({ method: 'snapshot', params: { v: 1, state: { chats: { c1: {}, c2: {} } } } })
    sync.ingest({ method: 'patch', params: { v: 2, ops: [{ op: 'delete', path: 'chats/c1' }] } })
    assert.equal(sync.get('chats/c1'), undefined)
    assert.ok(sync.get('chats/c2'), 'deleting one entry removed another')
  })
})