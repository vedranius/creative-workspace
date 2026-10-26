# Original Endnotes target service candidate

This native candidate connects the existing guarded `endnote.list` reply to the original `cmd:endnote.edit` generic form for an **explicit** `(story,id)` choice. It is not installed in the shipped source patch or browser UI. There is no new menu, result pane or replacement form. The original document already presents the generated Endnotes listing. Source endnotes.rs specifies editing through body references, rather than typing in that listing. Browser query delivery, automatic targeting of an explicitly selected original body reference, asynchronous correlation/cancellation, and real browser acceptance remain open.

`EndnoteTargetQuery::capture` creates an opaque, non-cloneable context for a hosted idle document. `request()` supplies the unchanged original query and expected version; the transport must provide its own request ID. `open(self, ...)` consumes that context, requires the current host session identity, document UID, canonical snapshot, revision, page, selection and dirty state, refuses an existing dialog/palette/pending action/held text queue, and validates the reply against the same context. It bounds result count/text/encoded JSON and wasm32 identities, then executes the registered original query on a separate COW Session to validate exact native ordering, identity and text. Only a matching explicit target opens the original generic form with its source fields. No document selection, revision, dirty state or history changes. Original form confirmation still sends the existing acknowledged mutation; this service cannot report save or edit success.

The wire snapshot must have exactly the original model shape. It is compared after deserialization through the same original Document type used to hydrate the mirror, so JSON transport forms such as 0 and 0.0 do not reject a legitimate document. This uses exact typed values, without epsilon comparisons; unknown/missing fields, altered model values and error replies with cached data refuse.

The fixture is generated native test content, not a user document. Source/patch/module/worker/fixture hashes are pinned in `UPSTREAM.json`. The verifier obtains a fresh actual owned-worker/gateway reply, hydrates the original DesignApp through its existing ACK method, stages this candidate as a native test module, runs the original UI suite and restores the exact original source in `finally`. An existing candidate path or stale evidence directory is refused. Native proof is distinct from browser integration and real OS/provider acceptance.

Run under the shared low-impact wrapper/lock with Rust1.99, jobs1, the existing Cargo cache and a short disk TMPDIR:

```sh
node scripts/verify-designcraft-endnote-target.mjs PINNED_PATCHED_SOURCE OWNED_WORKER GENERATED_FIXTURE EMPTY_OUTPUT
```

Set `CW_RUST_TOOLCHAIN_BIN` and the existing `CARGO_TARGET_DIR` as needed. `PROVENANCE_ONLY=1 node scripts/verify-designcraft-endnote-target.mjs` checks repository pins without native compilation; CI uses this and syntax checking. Native candidate/real gateway proof is local. This unfinished experiment has no product SemVer/release or new Actions assets. Exact candidate paths are excluded from release builds to preserve the existing immutable alpha77 draft; normal Checks remain enabled.
