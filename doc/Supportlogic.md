# BM_CII Support / Restraint Mapping Logic

## 1. Scope

This document defines the locked support/restraint mapping contract for the BM_CII GLB benchmark path.

The contract applies to two sources:

1. **InputXML actual restraints** — structured `<RESTRAINT>` rows from the InputXML.
2. **ISONOTE expected restraints** — node-wise sideloaded ISONOTE text converted into synthetic support records.

Both sources must route through the same support mapper and renderer. ISONOTE must not use a separate drawing path.

```text
InputXML actual restraint records ─┐
                                  ├─> common support mapper -> engineering contact -> optional visual resolver -> GLB glyphs
ISONOTE synthetic expected records ─┘
```

---

## 2. Non-negotiable rules

1. **Restraint data is record-scoped.** Do not carry-forward restraint values.
2. **Component/process carry-forward is separate.** It applies only to component fields such as material, pressure, temperature, wall thickness, etc.
3. **InputXML and ISONOTE use one support engine.** Source differs; rendering contract does not.
4. **Engineering contact is applied before visual resolver offset.**
5. **Visual resolver offset is applied only to final symbols that are axial / parallel to the pipe.**
6. **Line No. is node-wise sideloaded for BM_CII mock data.** Provenance/debug trace must never appear as Line No.

---

## 3. Record-scoped InputXML restraint data

Each `<RESTRAINT>` row owns its own fields:

| Field | Rule |
|---|---|
| `NODE` | Source support node. |
| `TYPE` | Source restraint type. |
| `XCOSINE`, `YCOSINE`, `ZCOSINE` | Belongs only to this row. |
| `GAP` | Belongs only to this row. No carry-forward. |
| `STIFFNESS`, `FRIC_COEF`, `CNODE`, `TAG`, `GUID` | Belongs only to this row. |

Example:

```xml
<RESTRAINT NUM="2" NODE="255.000000" TYPE="7.000000"
  XCOSINE="1.000000" YCOSINE="0.000000" ZCOSINE="0.000000" />
```

This GUIDE record uses `X` from its own row only. It must not borrow `+Y` or any other cosine from another restraint at node 255.

---

## 4. ISONOTE source contract

ISONOTE text is an expected-restraint source, not a geometry engine.

ISONOTE text must be parsed into normalized synthetic support records before rendering.

Minimum synthetic record shape:

| Field | Required value |
|---|---|
| `source` | `ISONOTE` |
| `sourceMode` | `EXPECTED_RESTRAINT` or `WARNING_ISONOTE` |
| `node` | Sideload node number |
| `family` | `REST`, `GUIDE`, `LINE_STOP`, `LIMIT`, `HOLDDOWN`, `AXIS_RESTRAINT`, `SPRING_WARNING`, etc. |
| `axisBasis` | `VERTICAL`, `LATERAL`, `AXIAL`, `EXPLICIT_AXIS`, or `UNRESOLVED_AXIS` |
| `axis` | `X`, `Y`, `Z`, `PIPE_AXIAL`, or mapper-derived |
| `sign` | `+`, `-`, `±`, or `UNKNOWN` |
| `loadText` | Example: `28kN`, `6kN`, `15kN` |
| `gapMm` | Explicitly parsed gap in mm, or `null` |
| `sourceNoteName` | Full original ISONOTE text exactly as sideloaded |
| `popupRequired` | `true` for unresolved `SINGLE AXIS` text |
| `warningText` | Required for `SPRING_WARNING`, unresolved axis, or negation conflicts |

ISONOTE negation must be respected:

| Text | Effect |
|---|---|
| `REST NOT DEFINED` | Do not generate REST from this note. |
| `WITHOUT GUIDE`, `NO GUIDE`, `GUIDE NOT REQUIRED` | Do not generate GUIDE from this note. |
| `WITHOUT LINE STOP`, `NO LINE STOP` | Do not generate LINE STOP from this note. |

---

## 5. Approved InputXML BM_CII support map

| Node | BM_CII item | Family | Axis basis | Source direction/cosine | Expected symbol |
|---:|---|---|---|---|---|
| 10 | `ANC` | `ANCHOR` | Flow-blocking | Plane normal to pipe tangent | Flat plate blocking flow |
| 35 | `+Y` | `REST` | Vertical | `+Y` | Single upward REST arrow |
| 35 | `X` | `AXIS_RESTRAINT` | Axis restraint | `X` | Axis pair unless classified otherwise |
| 35 | `Z` | `AXIS_RESTRAINT` | Axis restraint | `Z` | Axis pair unless classified otherwise |
| 130 | `+Z` | `LINESTOP` | Axial | `+Z` | Single directional axial stop |
| 190 | `ANC` | `ANCHOR` | Flow-blocking | Plane normal to pipe tangent | Flat plate blocking flow |
| 205 | `LIM` | `LIMIT` | Axial | Axial to pipe | Axial `±` pair |
| 205 | `Y` | `REST` | Vertical | `Y` | Vertical pair |
| 205 | `HANGER` | `HANGER / SPRING` | Hanger/spring | Vertical hanger reference | Coil only |
| 240 | `ANC` | `ANCHOR` | Flow-blocking | Plane normal to pipe tangent | Flat plate blocking flow |
| 255 | `GUIDE` | `GUIDE` | Lateral | GUIDE row cosine only | Lateral guide pair |
| 255 | `+Y` | `REST` | Vertical | `+Y` | Single upward REST arrow |

---

## 6. ISONOTE master mapping table

| Source keyword/type | Normalized family | Axis rule | Direction/sign rule | Symbol rule |
|---|---|---|---|---|
| `REST(...)` | `REST` | Global vertical `Y` | Always `+Y` | Single upward arrow |
| `+Y REST`, `+Y` as REST | `REST` | Global vertical `Y` | `+Y` | Single upward arrow |
| `HOLDDOWN`, `HOLD DOWN` | `HOLDDOWN` | Global vertical `Y` | `±Y` | Double vertical arrows |
| `GUIDE(...)` on horizontal pipe along X | `GUIDE` | Lateral `Z` | `±Z` | Lateral guide pair |
| `GUIDE(...)` on horizontal pipe along Z | `GUIDE` | Lateral `X` | `±X` | Lateral guide pair |
| `GUIDE(...)` on vertical pipe | `GUIDE` | Both lateral axes `X` and `Z` | `±X` and `±Z` | Four arrows around pipe |
| `LINE STOP(...)` | `LINE_STOP` | Local pipe axial | `± axial` unless explicit sign exists | Axial stop pair or signed stop |
| `LIMIT`, `LIM`, `LIMIT STOP` | `LIMIT` | Local pipe axial | Always `± axial` | Axial limit pair |
| `SINGLE AXIS X/Y/Z` without sign | `AXIS_RESTRAINT_UNRESOLVED` | Declared axis | Unknown | Warning/popup marker only |
| `+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z` | `AXIS_RESTRAINT` | Explicit axis | Explicit sign | Single directional axis arrow |
| `SPRING`, `HANGER` | `SPRING` / `HANGER` | Hanger/spring family | Source-defined | Coil/hanger symbol |
| `CAN SPRING`, `SPRING CAN`, `Can Spring` | `SPRING_WARNING` | Warning placed below pipe | Warning only | Coil warning below pipe |

---

## 7. Pipe basis

For every support record, compute:

```text
P = support point on pipe centreline
T = normalized pipe tangent / pipe axis
OD = pipe outside diameter
R = OD / 2
```

For the BM_CII benchmark:

- Do not silently transform axes.
- Do not use transformed/cached `axisGlb` or `pipeTangentGlb` unless the user enables transformation through an override popup.
- Use direct source/canvas axes.

---

## 8. Engineering contact and visual resolver sequence

The mapper must follow this order:

```text
1. Parse/normalize source record.
2. Apply engineering contact/geometry.
3. Inspect the final symbol orientation.
4. Apply visual resolver offset only when the final symbol is axial / parallel to the pipe.
```

Do not decide resolver offset from family name alone. Decide after the engineering symbol is built.

---

## 9. Non-axial contact rules

These are non-axial/radial/vertical symbols unless final geometry says otherwise:

- `REST`
- `GUIDE`
- `HOLDDOWN`
- non-axial `SPRING` / `HANGER`

Engineering contact:

```text
contact radius = OD / 2
```

If a positive same-record gap exists:

```text
effective offset = OD / 2 + 10 × GAP
```

Visual resolver offset:

```text
No OD × 2/3 resolver offset for non-axial final symbols.
```

---

## 10. Axial contact and visual resolver rules

These are axial/pipe-parallel when their final symbol is parallel to the pipe tangent:

- `LINE_STOP`
- `LIMIT` / `LIM`
- `AXIAL_RESTRAINT`
- resolved `SINGLE AXIS` if selected axis is pipe-parallel
- `SPRING` only if its final coil/symbol is pipe-parallel

Engineering contact:

```text
No radial OD/2 contact rule.
No positive gap: opposing axial arrow corners/tips touch.
Positive gap: axial separation = 10 × GAP.
```

Visual resolver:

```text
If final symbol is axial / parallel to pipe:
  apply visual resolver offset = OD × 2/3
```

Important:

```text
OD × 2/3 is not engineering gap.
OD × 2/3 is post-contact visual staging only.
```

---

## 11. GAP parsing

### 11.1 InputXML GAP

InputXML `GAP` belongs only to the same `<RESTRAINT>` row.

| Raw value | Meaning |
|---|---|
| missing / blank | no gap defined |
| negative sentinel such as `-1.010100` | no gap defined |
| `0` | zero gap |
| positive number | defined gap in mm |

No restraint GAP carry-forward is allowed.

### 11.2 ISONOTE GAP

Recognize explicit gap tokens only:

```text
GAP=25
GAP = 25
GAP=25mm
GAP:25
GAP 25 mm
```

Regex concept:

```text
\bGAP\s*(?:=|:)?\s*(-?\d+(?:\.\d+)?)\s*(MM|MILLIMETER|MILLIMETERS)?\b
```

Rules:

- Missing unit means mm.
- Gap attaches to the same restraint clause where written.
- Bare `GAP=...` after a comma applies only to the immediately previous restraint token.
- `REST(28kN)` is a load, not a gap.
- No ISONOTE gap carry-forward is allowed.

Examples:

```text
LINE STOP(15kN, GAP=25mm) -> LINE_STOP.gapMm = 25
GUIDE(6kN), GAP=10mm     -> GUIDE.gapMm = 10
REST(28kN)               -> REST.loadText = 28kN, gapMm = null
```

---

## 12. Family rules

### 12.1 REST

- REST is always global vertical `+Y` for ISONOTE.
- InputXML `+Y` REST is a single upward arrow.
- A `Y` pair from InputXML remains a vertical pair if classified as non-directional.
- Engineering contact uses pipe outside surface `OD/2`.

### 12.2 HOLDDOWN

- Always double vertical arrows on `±Y`.
- Distinct from GUIDE.
- Must not generate GUIDE.
- Engineering contact uses pipe outside surface `OD/2`.

### 12.3 GUIDE

InputXML GUIDE:

- Uses the cosine from its own restraint row only.
- Chooses the pipe-lateral axis closest to the GUIDE row cosine.
- Does not borrow any same-node REST/HANGER/LIMIT cosine.

ISONOTE GUIDE:

| Pipe orientation | GUIDE axis | Symbol |
|---|---|---|
| Horizontal pipe along X | `Z` | `±Z` pair |
| Horizontal pipe along Z | `X` | `±X` pair |
| Vertical pipe | `X` and `Z` | four arrows `±X`, `±Z` |

### 12.4 LINE STOP

- Axial family.
- If no sign is explicit, default is `± axial` pair.
- If sign is explicit, use single signed axial stop.
- No radial OD/2 engineering contact.
- No positive gap means opposing axial arrow corners/tips touch.
- Positive gap means separation is `10 × GAP`.
- Apply visual resolver `OD × 2/3` after contact if the final symbol is parallel to the pipe.

### 12.5 LIMIT / LIM

- Always `± axial`.
- Uses the same axial contact and visual resolver rules as LINE STOP.

### 12.6 SINGLE AXIS

- `SINGLE AXIS X/Y/Z` without `+` or `-` is unresolved.
- Do not assume the sign.
- Show warning marker / popup-required metadata.
- Only after user selects `+` or `-` should the mapper render final geometry.

### 12.7 HANGER / SPRING / CAN SPRING

- InputXML `HANGER`/`SPRING` is actual support if source defines it.
- `Can Spring`, `Spring Can`, or `CAN SPRING` in ISONOTE is a warning only.
- Warning coil appears below the pipe.
- Apply visual resolver `OD × 2/3` only if the final spring/coil geometry is pipe-parallel.

### 12.8 ANCHOR / ANC

- Flow-blocking / fixed plane at support node.
- Flat plate normal to pipe tangent.
- Plate centre is support point `P`.
- Plate size must cover pipe OD.

---

## 13. ISONOTE node-wise BM_CII expected records

| Node | ISONOTE text | Parsed expected records |
|---:|---|---|
| 35 | `REST(28kN), GUIDE(6kN), LINE STOP(15kN)` | `REST +Y`, `GUIDE lateral by pipe orientation`, `LINE_STOP ± axial` |
| 130 | `REST NOT DEFINED, SINGLE AXIS Z` | no REST, unresolved `SINGLE_AXIS_Z`, popup/warning required |
| 255 | `REST(3kN), GUIDE(1kN)` | `REST +Y`, `GUIDE lateral by pipe orientation` |
| 205 | `REST(10kN), HOLDDOWN, LINE STOP(6kN), Holddown without Guide Can Spring` | `REST +Y`, `HOLDDOWN ±Y`, `LINE_STOP ± axial`, no GUIDE, `SPRING_WARNING` coil below pipe |

---

## 14. Component panel rules

The property panel is an engineering review panel, not a raw metadata dump.

Default expanded sections:

1. `Line / Node`
2. `Component Data`
3. `Process / Analysis`

Default collapsed sections:

- `Identity`
- `Support / Restraint`
- `ISONOTE Annotation`
- `Source / Debug Summary`
- `Raw / Debug Metadata`
- `Rules / Notes`

Line number rules:

- `Line No.` comes only from real line-number metadata or BM_CII node-wise line-number sideload.
- Provenance strings must never be displayed as `Line No.`.
- BM_CII mock line-number sideload currently includes `Node 10 -> LINE XYZ`.
- Supports/restraints must not inherit component/process context.

The panel width and height should be user-adjustable for long ISONOTE/source/debug text review.

---

## 15. QC checklist

Every generated BM_CII support GLB must pass these checks:

1. InputXML actual supports and ISONOTE expected supports use the common mapper.
2. ISONOTE does not use a separate glyph renderer path.
3. Every InputXML restraint row uses its own cosine and gap.
4. No restraint carry-forward is applied.
5. Component/process carry-forward does not leak into support/restraint properties.
6. REST is `+Y` upward for ISONOTE.
7. HOLDDOWN is `±Y` double vertical.
8. GUIDE uses correct lateral rule.
9. LIMIT/LIM is always `± axial`.
10. Axial contact uses corner/tip touch or `10 × GAP` separation.
11. Visual resolver `OD × 2/3` applies only after final symbol is known to be axial/pipe-parallel.
12. `SINGLE AXIS` without sign creates warning/popup-required state.
13. `Can Spring` creates a below-pipe warning coil, not confirmed actual support.
14. Layer metadata keeps InputXML actual, ISONOTE expected, and warning symbols distinguishable.
15. Component panel defaults show only Line / Component / Process sections expanded.
