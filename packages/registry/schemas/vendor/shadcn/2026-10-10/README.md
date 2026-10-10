# Vendored shadcn schema profile — 2026-10-10

Fetched on 2026-10-10 from the upstream shadcn schema endpoints:

- `https://ui.shadcn.com/schema/registry.json`
- `https://ui.shadcn.com/schema/registry-item.json`

The upstream bytes had these SHA-256 digests:

```text
registry.json       e716ebe595bbc189db2627cb75f0484cd765a09eb397a89b1f1c49074220d4bb
registry-item.json  cdf0fba75a26ebf594018264eff2d55407ec14deb3071d0fce0e2b20848e5d44
```

The vendored profile differs only by adding stable local URN `$id` values and
replacing the root schema's network `$ref` with the vendored item URN. No
validator path performs a remote schema fetch. The vendored-byte digests are:

```text
registry.schema.json       1c27ab8805f3c4e0523fdafdb364661352f3e11120ea0e06962b7d03af4253a5
registry-item.schema.json  bbe7dfab6422c9c197d268c8cef18bf39229c87cd311573257b9595f9c8b26e3
```
