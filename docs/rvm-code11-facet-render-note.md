# RMSS RVM code 11 facet rendering note

The RMSS Navis comparison showed a rendering-policy issue:

- `/PS-171036.10` is a small code 11 facet plate in Navis.
- `/PS-171035.6H` is a small native support/member group in Navis.
- The browser viewer was allowed to promote code 11 entries with `SUPPORT` semantics into synthetic `SUPPORT_STAND` placeholder geometry.

That placeholder path is intentionally approximate and uses minimum support dimensions. It must not be used for native RVM code 11 facet groups because it can render a large artificial block in place of a small plate/member.

The active policy is:

1. Decoded code 11 facet groups stay native facet groups.
2. Undecoded code 11 facet groups fall back only to wireframe bbox diagnostics.
3. Code 11 facet groups are not semantically promoted to `SUPPORT_STAND`, `VALVE_COMPOSITE`, or other synthetic placeholder solids.
