# `@ui-stdlib/registry`

The registry package owns the v1 house manifest admission boundary and the
same-host deterministic artifact builder.

`admitRegistry(source, { evidence })` is the only manifest parser. It first
validates the vendored shadcn-compatible structural profile, then enforces the
house semantic rules (immutable provenance, portable paths, accessibility test
results, layer separation, review declarations, and declaration health).
The evidence resolver is the trust boundary: conformance and declaration
receipts must bind the canonical manifest SHA-256, item, named test, runner or
compiler result, and exact ruled waiver. Manifest-local pass strings are not
evidence. Every file carries a SHA-256 inside that normalized manifest; the
builder verifies source bytes against it before publication. Receipt bytes are
hashed and their bound facts are checked rather than trusting a digest-shaped
string.
`buildRegistryArtifact` calls that API rather than maintaining another parser
or weaker build-only validator. Its `repositoryRoot` option binds filesystem
custody at construction: `sourceRoot` and `outputDirectory` must be physical,
symlink-free descendants of that root. Caller spelling or links cannot rebind
where source bytes are read or artifacts are published.

Artifacts contain canonical JSON over the normalized admitted manifest and an
ordered list of `(path, base64 bytes)`. Their full 64-character SHA-256 filename
hashes this versioned preimage:

```text
utf8("ui-stdlib.registry-artifact/v1\\0sha256\\0") || canonical-envelope-bytes
```

Publication is atomic in the output directory. The v1 contract claims exact
reproduction on the same host. Cross-OS parity is deliberately unclaimed until
CI produces the required receipt.
