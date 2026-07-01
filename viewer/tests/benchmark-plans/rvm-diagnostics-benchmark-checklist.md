# RVM Diagnostics Benchmark Checklist

This checklist is for future GAS/RMSS diagnostics-only benchmark acceptance. It is markdown only. It does not define parser behavior and does not approve visual RVM output.

## A. GAS benchmark

- [ ] source file identity recorded
- [ ] preflight report present
- [ ] diagnostics report present
- [ ] CNTB candidates counted
- [ ] CNTE candidates counted
- [ ] PRIM candidates counted
- [ ] native code counts present
- [ ] code 4 candidates counted
- [ ] code 11 candidates counted
- [ ] unknown code count present
- [ ] invalid bbox count present
- [ ] hierarchy candidate depth present
- [ ] no stage model generated in diagnostics-only phase
- [ ] no render plan generated in diagnostics-only phase
- [ ] no geometry chunks generated in diagnostics-only phase

## B. RMSS benchmark

- [ ] source file identity recorded
- [ ] preflight report present
- [ ] diagnostics report present
- [ ] CNTB candidates counted
- [ ] CNTE candidates counted
- [ ] PRIM candidates counted
- [ ] native code counts present
- [ ] code 4 candidates counted
- [ ] code 11 candidates counted
- [ ] unknown code count present
- [ ] invalid bbox count present
- [ ] hierarchy candidate depth present
- [ ] no stage model generated in diagnostics-only phase
- [ ] no render plan generated in diagnostics-only phase
- [ ] no geometry chunks generated in diagnostics-only phase

## C. Rejection conditions

- [ ] parser claims stage model before hierarchy/PRIM diagnostics exist
- [ ] code 4 rendered without native params
- [ ] code 11 rendered without validated geometry chunk metadata
- [ ] semantic name used to create visible geometry
- [ ] semantic-only geometry is visible without diagnostic fallback
- [ ] support/foundation/valve/flange generated from name/path only
- [ ] old RVM Viewer module imported
- [ ] UI claims RVM loaded when parser is diagnostics-only
