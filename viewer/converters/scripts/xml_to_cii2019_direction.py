#!/usr/bin/env python3
"""XML -> CII(2019) wrapper that preserves enriched restraint direction cosines.

The active browser converter invokes this wrapper.  It keeps enriched
Restraint/DirectionCosineX/Y/Z values and also lets staged-json CMPSUPGAP
annotations drive the CII restraint gap value when present.
"""
from __future__ import annotations

from dataclasses import dataclass
import math
import re
import xml.etree.ElementTree as ET

import xml_to_cii2019 as base
import xml_to_cii2019_patched as patched


@dataclass(frozen=True)
class DirectionRestraintSpec:
    type_code: int
    stiffness: float
    gap: float
    friction: float
    is_open_end: bool
    direction_cosines: tuple[float, float, float] | None = None


def _normalize_direction(values: tuple[float, float, float] | None) -> tuple[float, float, float] | None:
    if values is None:
        return None
    x, y, z = values
    if not all(math.isfinite(v) for v in (x, y, z)):
        return None
    length = math.sqrt((x * x) + (y * y) + (z * z))
    if length <= 1e-9:
        return None
    return (x / length, y / length, z / length)


def _parse_direction_cosines(restraint_element: ET.Element, namespace: str) -> tuple[float, float, float] | None:
    raw = (
        base._child_text(restraint_element, namespace, "DirectionCosineX"),
        base._child_text(restraint_element, namespace, "DirectionCosineY"),
        base._child_text(restraint_element, namespace, "DirectionCosineZ"),
    )
    if not any(base._safe_text(value) for value in raw):
        return None
    values: list[float] = []
    for index, value in enumerate(raw, 1):
        parsed = base._parse_optional_float(value, f"Restraint/DirectionCosine{index}")
        if parsed is None:
            return None
        values.append(parsed)
    return _normalize_direction((values[0], values[1], values[2]))


def _first_child_text(parent: ET.Element, namespace: str, names: tuple[str, ...]) -> str:
    for name in names:
        value = base._safe_text(base._child_text(parent, namespace, name))
        if value:
            return value
    return ""


def _parse_cmpsupgap_value(text: str) -> float | None:
    match = re.search(r"[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?", base._safe_text(text))
    if not match:
        return None
    value = float(match.group(0))
    return value if math.isfinite(value) else None


def _cmpsupgap_for_restraint(node_element: ET.Element, restraint_element: ET.Element, namespace: str) -> float | None:
    # PS value is preferred over POS because support tag matching is less ambiguous
    # than coordinate matching.  Restraint-level fields are accepted for forward
    # compatibility; current enrichment writes node-level fields.
    for parent in (restraint_element, node_element):
        value = _first_child_text(parent, namespace, ("CMPSUPGAP_PS", "CMPSUPGAP_POS", "CMPSUPGAP"))
        parsed = _parse_cmpsupgap_value(value)
        if parsed is not None:
            return parsed
    return None


def _parse_restraints_with_direction(node_element: ET.Element, namespace: str) -> tuple[DirectionRestraintSpec, ...]:
    restraint_elements = node_element.findall(base._q(namespace, "Restraint"))
    if not restraint_elements:
        return tuple()
    if len(restraint_elements) > base.RESTRAINT_SLOTS_PER_AUX:
        raise ValueError(
            f"Only {base.RESTRAINT_SLOTS_PER_AUX} Restraint entries per node are supported by one CII RESTRANT block."
        )

    specs: list[DirectionRestraintSpec] = []
    for restraint_element in restraint_elements:
        type_text = base._child_text(restraint_element, namespace, "Type")
        if not type_text:
            raise ValueError("Restraint element must contain Type.")
        stiffness = base._parse_optional_float(
            base._child_text(restraint_element, namespace, "Stiffness"), "Restraint/Stiffness"
        )
        cmpsupgap = _cmpsupgap_for_restraint(node_element, restraint_element, namespace)
        xml_gap = base._parse_optional_float(base._child_text(restraint_element, namespace, "Gap"), "Restraint/Gap")
        gap = cmpsupgap if cmpsupgap is not None else xml_gap
        friction = base._parse_optional_float(
            base._child_text(restraint_element, namespace, "Friction"), "Restraint/Friction"
        )
        specs.append(
            DirectionRestraintSpec(
                type_code=base._restraint_type_to_code(type_text),
                stiffness=0.0 if stiffness is None else stiffness,
                gap=0.0 if gap is None else gap,
                friction=0.0 if friction is None else friction,
                is_open_end=False,
                direction_cosines=_parse_direction_cosines(restraint_element, namespace),
            )
        )
    return tuple(specs)


def _direction_for_spec(spec: object) -> tuple[float, float, float]:
    explicit = _normalize_direction(getattr(spec, "direction_cosines", None))
    if explicit is not None:
        return explicit
    return base._direction_cosines_for_restraint_type(spec.type_code, spec.is_open_end)


def _direction_enabled_restraint_payload_factory(support_config: dict):
    def _build_restraint_payload(model: base.ConversionModel, cfg: dict | None = None) -> list[str]:
        actual_config = support_config if cfg is None else cfg
        lines: list[str] = []
        for assigned in model.restraints:
            for slot_index in range(base.RESTRAINT_SLOTS_PER_AUX):
                if slot_index < len(assigned.specs):
                    spec = assigned.specs[slot_index]
                    cx, cy, cz = _direction_for_spec(spec)
                    fric_val = patched._cii_friction_value(spec.friction, actual_config)
                    line1 = base._row([
                        base._format_auto_float(float(assigned.node_number)),
                        base._format_auto_float(float(spec.type_code)),
                        base._format_auto_float(spec.stiffness),
                        base._format_fixed_float(spec.gap, 6),
                        base._format_fixed_float(fric_val, 6),
                        base._format_fixed_float(0.0, 6),
                    ])
                    raw_tag = assigned.kind if slot_index == 0 else ""
                else:
                    cx, cy, cz = 0.0, 0.0, 0.0
                    line1 = base._row([
                        base._format_fixed_float(0.0, 6),
                        base._format_fixed_float(0.0, 6),
                        base._format_auto_float(base.DEFAULT_LINEAR_STIFFNESS),
                        base._format_fixed_float(0.0, 6),
                        base._format_fixed_float(0.0, 6),
                        base._format_fixed_float(0.0, 6),
                    ])
                    raw_tag = ""
                cz_decimals = 6 if abs(cz) < 1e-9 else 5
                line2 = base._row([
                    base._format_fixed_float(cx, 6),
                    base._format_fixed_float(cy, 6),
                    base._format_fixed_float(cz, cz_decimals),
                ])
                support_tag = base._support_tag_for_cii_aux(raw_tag, actual_config)
                support_guid = base._support_guid_for_cii_aux(getattr(assigned, "support_guid", ""), actual_config)
                tag_line = base._cii_aux_string_record(support_tag)
                guid_line = base._cii_aux_string_record(support_guid)
                lines.extend([line1, line2, tag_line, guid_line])
        return lines
    return _build_restraint_payload


def install_direction_cosine_patch() -> None:
    base.RestraintSpec = DirectionRestraintSpec  # type: ignore[assignment]
    base._parse_restraints = _parse_restraints_with_direction  # type: ignore[assignment]
    patched._patched_build_restraint_payload_factory = _direction_enabled_restraint_payload_factory  # type: ignore[assignment]


install_direction_cosine_patch()


if __name__ == "__main__":
    patched.main()
