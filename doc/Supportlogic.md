# BM_CII InputXML Basic Support / Restraint Placement Logic

## 1. Scope

This document defines the current support and restraint placement logic for the **BM_CII InputXML Basic GLB** path.

The intent is to keep the benchmark path deterministic and reviewable:

- Input source: **InputXML restraint records only**.
- Do not mix ISONOTE records into this benchmark path.
- Do not use Temp1/material heatmap variants for this benchmark review.
- Do not apply coordinate transformation silently.
- If transformation is required later, the converter must show a user-facing override popup and use the values selected by the user.

The support renderer must treat each restraint row as an independent engineering record. Records at the same node must not share axis/cosine data unless an explicit user override says so.

---

## 2. Core principles

### 2.1 Record-scoped restraint data

Each `<RESTRAINT>` row owns its own fields:

- `NODE`
- `TYPE`
- `XCOSINE`
- `YCOSINE`
- `ZCOSINE`
- `STIFFNESS`
- `GAP`
- `FRIC_COEF`
- `CNODE`
- `TAG`
- `GUID`

Do **not** reuse cosine from another restraint row, even if both records have the same node number.

Example:

```xml
<RESTRAINT NUM="2" NODE="255.000000" TYPE="7.000000"
  XCOSINE="1.000000" YCOSINE="0.000000" ZCOSINE="0.000000" />
```

This GUIDE record uses its own cosine only:

```text
GUIDE cosine = X
```

It must not use the `+Y` cosine from another restraint at node 255.

---

### 2.2 Separate engineering meaning from rendering implementation

The support data model uses separate fields:

| Field | Meaning |
|---|---|
| `BM_CII item` | Benchmark item text such as `ANC`, `+Y`, `X`, `Z`, `LIM`, `HANGER`, `GUIDE`. |
| `Family` | Engineering family: `ANCHOR`, `REST`, `AXIS RESTRAINT`, `LINESTOP / DIRECTIONAL STOP`, `LIMIT`, `HANGER / SPRING`, `GUIDE`. |
| `Axis (Pipe Axis basis)` | Pipe-relative action basis: `AXIAL`, `LATERAL`, `VERTICAL`, `AXIAL / FLOW-BLOCKING`, etc. |
| `Cosine` | Source cosine direction or semantic cosine note. |
| `Render kind` | Internal renderer primitive. It must not override the engineering family. |
| `Expected GLB symbol` | The visible symbol contract. |

Important:

```text
Family != Render kind
```

For example, an `AXIS RESTRAINT` may internally use the axis-arrow renderer, but it must not be reported as engineering family `REST` unless the BM_CII table says it is REST.

---

## 3. BM_CII approved support map

The BM_CII InputXML Basic benchmark uses the following approved map.

| Node | BM_CII item | Family | Axis (Pipe Axis basis) | Cosine | Render kind | Expected GLB symbol |
|---:|---|---|---|---|---|---|
| 10 | ANC | ANCHOR | AXIAL / FLOW-BLOCKING | PLANE BLOCKING THE FLOW | ANCHOR | Flat plate blocking flow |
| 35 | +Y | REST | VERTICAL | VERTICAL AXIS | REST | Single axis arrow toward +Y |
| 35 | X | AXIS RESTRAINT | AXIAL | X | N/A | Axis pair along X |
| 35 | Z | AXIS RESTRAINT | AXIAL | Z | N/A | Axis pair along Z |
| 130 | +Z | LINESTOP / DIRECTIONAL STOP | AXIAL | +Z | N/A | Single axial arrow toward +Z |
| 190 | ANC | ANCHOR | AXIAL / FLOW-BLOCKING | PLANE BLOCKING THE FLOW | ANCHOR | Flat plate blocking flow |
| 205 | LIM | LIMIT | AXIAL | AXIAL TO PIPE | LIMIT | Axial pair |
| 205 | Y | REST | VERTICAL | VERTICAL AXIS | REST | Axis pair along Y |
| 205 | HANGER | HANGER / SPRING | LATERAL / VERTICAL HANGER | VERTICAL AXIS | SPRING | Coil only, no arrow |
| 240 | ANC | ANCHOR | AXIAL / FLOW-BLOCKING | PLANE BLOCKING THE FLOW | ANCHOR | Flat plate blocking flow |
| 255 | GUIDE | GUIDE | LATERAL | AS PER NODE DATA | GUIDE | GUIDE lateral arrow pair |
| 255 | +Y | REST | VERTICAL | VERTICAL AXIS | REST | Single axis arrow toward +Y |

---

## 4. Axis and cosine rules

### 4.1 Positive cosine is not automatically signed

A positive source cosine does not automatically mean `+X`, `+Y`, or `+Z`.

Use the BM_CII type map to determine whether the restraint is directional.

Examples:

```text
TYPE 3 + ZCOSINE=1.0  => Z, not +Z
TYPE 18 + ZCOSINE=1.0 => +Z directional stop
```

### 4.2 Directional and non-directional axis labels

Use this terminology:

| Label form | Meaning | Symbol rule |
|---|---|---|
| `X`, `Y`, `Z` | Non-directional axis restraint | Two opposed arrows |
| `+X`, `+Y`, `+Z` | Directional positive restraint | One arrow in positive direction |
| `-X`, `-Y`, `-Z` | Directional negative restraint | One arrow in negative direction |

---

## 5. Pipe geometry basis

For each support record, compute:

```text
P = support point on pipe centreline
T = normalized pipe tangent / pipe axis
R = OD / 2
```

For the InputXML Basic benchmark:

- Do not apply coordinate transformation.
- Do not use transformed/cached `axisGlb` or `pipeTangentGlb` unless the user enables transformation in a popup.
- The benchmark uses direct canvas/source axes.

### 5.1 Pipe lateral basis

There are always two lateral axes perpendicular to the pipe tangent.

```text
UP = [0, 1, 0]
L1 = normalize(UP - T * dot(UP, T))
L2 = normalize(T × L1)
```

If `UP` is nearly parallel to `T`, select another stable world axis and project it perpendicular to `T`.

---

## 6. OD/2 placement contract

All support and restraint symbols must be placed using pipe OD contact geometry. This is not GUIDE-only.

### 6.1 Required global rule

```text
No arrow head shall be placed on the pipe centreline unless it is a diagnostic marker.
Arrow heads must touch or offset from an OD/2 contact point.
```

The base contact points are:

```text
CIRCUM_TOP   = P + top  * R
CIRCUM_BOT   = P - top  * R
CIRCUM_SIDE1 = P + side * R
CIRCUM_SIDE2 = P - side * R
```

where `top` and `side` are lateral directions perpendicular to pipe tangent.

---

## 7. Independent OD/GAP placement policy

An independent module must check placement after the family renderer decides symbol shape.

### 7.1 Parallel-to-pipe check

For the applied restraint direction `A`:

```text
parallel = abs(dot(normalize(A), normalize(T))) >= tolerance
```

Recommended tolerance:

```text
0.92 to 0.98
```

If the applied restraint is parallel to the pipe, do not place arrow tips along the centreline direction. Move the restraint to any valid lateral OD/2 axis.

```text
parallel-to-pipe arrow tip = P ± selected_lateral_axis * R
arrow direction = A
```

For current BM_CII review, use a stable lateral axis such as `CIRCUM_BOT` unless the family-specific rule gives a better axis.

### 7.2 GAP offset rule

If source `GAP` is positive:

```text
GAP > 0
```

then move the arrow head away from the pipe by:

```text
GAP offset = GAP * 10 mm
```

The displacement direction is away from the pipe, along the arrow-away/radial-outward direction.

```text
final_tip = od_contact_tip + outward_direction * (GAP * 10 mm)
```

For this BM_CII benchmark, current GAP values are negative sentinel values such as `-1.010100`, so no positive GAP offset is applied.

---

## 8. Symbol family rules

### 8.1 ANCHOR / ANC

Engineering meaning:

```text
ANCHOR = flow-blocking / fixed plane at support node
```

Symbol:

```text
Flat plate normal to pipe tangent.
Plate diameter/radius must cover pipe OD.
```

Placement:

```text
Plate centre = P
Plate normal = T
Plate size >= OD
```

---

### 8.2 REST +Y / REST Y

Engineering meaning:

```text
REST = vertical support/restraint family
```

Rules:

```text
+Y = single arrow toward +Y
Y  = two opposed vertical arrows
```

OD/2 placement:

```text
+Y arrow head touches bottom OD: CIRCUM_BOT
-Y arrow head touches top OD:    CIRCUM_TOP
Y pair uses both CIRCUM_BOT and CIRCUM_TOP
```

Reason:

A positive vertical support arrow points upward into the pipe from below, so the arrow head must touch the bottom OD.

---

### 8.3 AXIS RESTRAINT X/Y/Z

Engineering meaning:

```text
Axis restraint = two opposed arrows along the given axis unless signed.
```

Rules:

```text
X/Y/Z    => axis pair
+X/+Y/+Z => single positive direction arrow
-X/-Y/-Z => single negative direction arrow
```

OD/2 placement:

- If the axis is lateral to pipe: use the OD point opposite the arrow direction for each arrow head.
- If the axis is parallel to pipe: use the independent OD/GAP policy to move the arrow to a lateral OD/2 contact axis.

---

### 8.4 LINESTOP / directional stop

Engineering meaning:

```text
LINESTOP = pipe-axial restraint family.
```

Rules:

```text
+Z / +X / +Y = single directional axial stop if BM_CII map classifies it as signed.
X/Y/Z        = axial pair only if classified as non-directional stop.
```

OD/2 placement:

```text
Arrow line must be offset away from centreline to a lateral OD/2 contact point.
```

For BM_CII node 130:

```text
Node 130 +Z => LINESTOP / directional stop => single axial arrow toward +Z
```

---

### 8.5 LIMIT / LIM

Engineering meaning:

```text
LIMIT = axial limit family.
```

For BM_CII node 205:

```text
LIM = LIMIT
Axis (Pipe Axis basis) = AXIAL
Cosine = AXIAL TO PIPE
Symbol = axial pair
```

Placement:

```text
Use pipe tangent as arrow direction.
Offset arrow tips to lateral OD/2 contact anchor.
Do not use centreline as arrow tip.
```

---

### 8.6 GUIDE

Engineering meaning:

```text
GUIDE = lateral opposed-arrow pair.
```

Rules:

```text
GUIDE uses the COSINE AXIS OF THAT RESTRAINT ROW ONLY.
Do not use another restraint's cosine from the same node.
Do not use REST/HANGER/LIMIT cosine from the same node.
```

There are always two pipe-lateral axes. GUIDE must choose the correct lateral axis by comparing the GUIDE row cosine with the two pipe-lateral axes.

```text
C = normalized cosine of the GUIDE restraint row
L1 = first pipe-lateral axis
L2 = second pipe-lateral axis

Use L1 if abs(dot(C, L1)) >= abs(dot(C, L2))
Use L2 otherwise
Preserve sign by dot(C, selected_axis)
```

OD/2 placement:

```text
tip+  = P + G * R
tip-  = P - G * R
```

Both guide arrows point inward and their heads touch pipe OD.

For BM_CII node 255:

```xml
<RESTRAINT NUM="2" NODE="255.000000" TYPE="7.000000"
  XCOSINE="1.000000" YCOSINE="0.000000" ZCOSINE="0.000000" />
```

Therefore:

```text
GUIDE cosine = X from its own row
GUIDE axis   = canvas X lateral axis
GUIDE tips   = P ± X * OD/2
```

---

### 8.7 HANGER / SPRING

Engineering meaning:

```text
HANGER / SPRING = vertical hanger family.
```

Symbol:

```text
Coil only. No arrow.
```

Placement:

```text
Coil starts from CIRCUM_TOP or a vertical hanger reference point above the pipe OD.
```

---

## 9. Transformation popup requirement

The InputXML Basic benchmark must not silently transform axes.

If a future run requires transformation, show a popup before conversion with at least:

- Enable/disable transformation.
- Source axis basis preview.
- Target/canvas axis basis preview.
- Per-node single-axis restraint override.
- Per-record cosine override.
- Clues from ISONOTE text such as:
  - `Single axis`
  - `Hold down`
  - `Holddown`

No transformation should be applied unless the user confirms it.

---

## 10. QC checklist

Every generated BM_CII support GLB must pass these checks:

1. Rendered support count equals expected InputXML rows.
2. No ISONOTE records are mixed into InputXML Basic output.
3. No Temp1/material heatmap variant is mixed into this support benchmark.
4. Every restraint row uses its own cosine.
5. Every arrow head is placed at or offset from OD/2 contact point.
6. Positive GAP moves arrow head away from pipe by `GAP * 10 mm`.
7. GUIDE uses its own row cosine and chooses one of the two pipe-lateral axes.
8. HANGER/SPRING contains no arrow, only coil.
9. ANCHOR appears as a flat flow-blocking plate.
10. Metadata keeps `Family`, `Render kind`, `Axis (Pipe Axis basis)`, and `Cosine` as separate fields.

---

## 11. Current BM_CII expected result summary

```text
10   ANC        => ANCHOR flat plate
35   +Y         => REST vertical single +Y arrow
35   X          => AXIS RESTRAINT pair along X
35   Z          => AXIS RESTRAINT pair along Z, OD/2 offset if pipe-parallel
130  +Z         => LINESTOP single axial arrow, OD/2 offset
190  ANC        => ANCHOR flat plate
205  LIM        => LIMIT axial pair, OD/2 offset
205  Y          => REST vertical pair
205  HANGER     => SPRING/HANGER coil only
240  ANC        => ANCHOR flat plate
255  GUIDE      => GUIDE lateral pair using its own X cosine
255  +Y         => REST vertical single +Y arrow
```
