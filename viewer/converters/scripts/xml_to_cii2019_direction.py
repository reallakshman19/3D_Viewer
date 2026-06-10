#!/usr/bin/env python3
"""XML -> CII(2019) wrapper that preserves enriched restraint direction cosines.

The active browser converter invokes this wrapper. It keeps enriched
Restraint/DirectionCosineX/Y/Z values, lets staged-json CMPSUPGAP annotations
control restraint gap values, and maps SIF&TEES type code from enriched TEE
DTXR/description fields.
"""
from __future__ import annotations

from dataclasses import dataclass
import math
import re
import xml.etree.ElementTree as ET

import xml_to_cii2019 as base
import xml_to_cii2019_patched as patched


DEFAULT_TEE_SIF_TYPE_MAPPING = [
    {
        "code": 1,
        "label": "Reinforced Fabricated Tee",
        "patterns": [
            r"\bREINFORCED\b.*\bFAB(?:RICATED)?\b.*\bTEE\b",
            r"\bFAB(?:RICATED)?\b.*\bREINFORCED\b.*\bTEE\b",
            r"\bREINF(?:ORCED)?\b.*\bTEE\b",
        ],
    },
    {
        "code": 2,
        "label": "Unreinforced Fabricated Tee",
        "patterns": [
            r"\bUN[-\s]?REINFORCED\b.*\bFAB(?:RICATED)?\b.*\bTEE\b",
            r"\bFAB(?:RICATED)?\b.*\bUN[-\s]?REINFORCED\b.*\bTEE\b",
            r"\bUNREINF(?:ORCED)?\b.*\bTEE\b",
        ],
    },
    {
        "code": 3,
        "label": "Welding Tee",
        "patterns": [
            r"\bWELD(?:ING)?\s+TEE\b",
            r"\bTEE\b.*\bBW\b",
            r"\bTEE\b.*\bBUTT\s*WELD\b",
            r"\bTEE\s+(?:EQUAL|REDUC(?:ING|ER)?)\b",
            r"\bTEEB?\b",
        ],
    },
    {
        "code": 4,
        "label": "Sweepolet",
        "patterns": [r"\bSWEEPOLET\b", r"\bSWEEP\s*OLET\b"],
    },
    {
        "code": 5,
        "label": "Weldolet",
        "patterns": [r"\bWELDOLET\b", r"\bWELD\s*OLET\b", r"\bWOLET\b"],
    },
    {
        "code": 6,
        "label": "Extruded Welding Tee",
        "patterns": [
            r"\bEXTRUDED\b.*\bWELD(?:ING)?\b.*\bTEE\b",
            r"\bEXTRUDED\b.*\bTEE\b",
            r"\bEXT(?:RUDED)?\s+TEE\b",
        ],
    },
]


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
    # than coordinate matching. Restraint-level fields are accepted for forward
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


def _tee_description_by_node(xml_path) -> dict[int, str]:
    root = ET.parse(xml_path).getroot()
    namespace = base._namespace(root.tag)
    out: dict[int, str] = {}
    names = (
        "TEEDESC_REFBASIS",
        "TEEDESC_POS",
        "TEEDESC",
        "DTXR_POS",
        "DTXR_PS",
        "DTXR",
    )
    for node in root.iter():
        if base._local_name(node.tag) != "Node":
            continue
        node_no = base._parse_optional_int(base._child_text(node, namespace, "NodeNumber"), "Node/NodeNumber")
        if node_no is None or node_no <= 0:
            continue
        text = _first_child_text(node, namespace, names)
        if text:
            out[node_no] = text
    return out


def _defaulted_tee_sif_mapping(support_config: dict) -> list[dict]:
    mapping = support_config.get("teeSifTypeMapping")
    if not isinstance(mapping, list) or not mapping:
        support_config["teeSifTypeMapping"] = DEFAULT_TEE_SIF_TYPE_MAPPING
        return DEFAULT_TEE_SIF_TYPE_MAPPING
    return [entry for entry in mapping if isinstance(entry, dict)]


def _regex_or_contains(pattern: str, text: str) -> bool:
    try:
        return re.search(pattern, text, flags=re.I) is not None
    except re.error:
        return pattern.upper() in text.upper()


def _tee_sif_type_from_description(text: str, support_config: dict) -> int:
    normalized = re.sub(r"\s+", " ", base._safe_text(text)).upper()
    if not normalized:
        return int(support_config.get("defaultTeeSifType", 0) or 0)

    # Specific hard guards run before any broad TEE/BW rule.
    specific = [
        (4, (r"\bSWEEPOLET\b", r"\bSWEEP\s*OLET\b")),
        (5, (r"\bWELDOLET\b", r"\bWELD\s*OLET\b", r"\bWOLET\b")),
        (6, (r"\bEXTRUDED\b.*\bTEE\b", r"\bEXT(?:RUDED)?\s+TEE\b")),
        (2, (r"\bUN[-\s]?REINF(?:ORCED)?\b.*\bTEE\b",)),
        (1, (r"\bREINF(?:ORCED)?\b.*\bTEE\b",)),
    ]
    for code, patterns in specific:
        if any(_regex_or_contains(pattern, normalized) for pattern in patterns):
            return code

    for entry in _defaulted_tee_sif_mapping(support_config):
        try:
            code = int(float(entry.get("code")))
        except (TypeError, ValueError):
            continue
        patterns = entry.get("patterns") if isinstance(entry.get("patterns"), list) else []
        label = base._safe_text(entry.get("label"))
        search_terms = [*patterns, label]
        if any(term and _regex_or_contains(str(term), normalized) for term in search_terms):
            return code

    if re.search(r"\bTEE\b", normalized) and re.search(r"\b(BW|BUTT\s*WELD|WELD(?:ING)?|EQUAL|REDUC(?:ING|ER)?)\b", normalized):
        return 3
    return int(support_config.get("defaultTeeSifType", 0) or 0)


def _sif_payload_factory(tee_desc_by_node: dict[int, str], support_config: dict):
    def _build_sif_payload(model: base.ConversionModel) -> list[str]:
        lines: list[str] = []
        zero_row = base._row([
            base._format_fixed_float(0.0, 6),
            base._format_fixed_float(0.0, 6),
            base._format_fixed_float(0.0, 6),
            base._format_fixed_float(0.0, 6),
            base._format_fixed_float(0.0, 6),
            base._format_fixed_float(0.0, 6),
        ])
        for edge in model.sif_edges:
            desc = tee_desc_by_node.get(edge.to_node.node_number, "")
            tee_type = _tee_sif_type_from_description(desc, support_config)
            first = base._row([
                base._format_auto_float(float(edge.to_node.node_number)),
                base._format_fixed_float(float(tee_type), 5),
                base._format_fixed_float(0.0, 6),
                base._format_fixed_float(0.0, 6),
                base._format_fixed_float(0.0, 6),
                base._format_fixed_float(0.0, 6),
            ])
            lines.append(first)
            for _ in range(9):
                lines.append(zero_row)
        return lines
    return _build_sif_payload


def install_direction_cosine_patch() -> None:
    base.RestraintSpec = DirectionRestraintSpec  # type: ignore[assignment]
    base._parse_restraints = _parse_restraints_with_direction  # type: ignore[assignment]
    patched._patched_build_restraint_payload_factory = _direction_enabled_restraint_payload_factory


def main() -> None:
    args = patched._parse_args()
    support_config = patched._load_support_config(args.support_config_json)
    if args.split_condensed_valve_flange is not None:
        support_config["splitCondensedValveFlange"] = bool(args.split_condensed_valve_flange)
    support_config.setdefault("teeSifTypeMapping", DEFAULT_TEE_SIF_TYPE_MAPPING)
    support_config.setdefault("defaultTeeSifType", 0)

    input_xml = patched._maybe_enrich_from_staged_json(args.input, args.staged_json, support_config)
    input_xml = patched._apply_process_data_to_xml(input_xml, support_config)
    tee_desc_by_node = _tee_description_by_node(input_xml)
    insulation_density_map = patched._branch_insulation_density_map(input_xml)
    hydro_pressure_map = patched._branch_hydro_pressure_map(input_xml)
    document = base._parse_xml_document(input_xml)
    dtxr_specs, node_number_kind_map = patched._build_keyword_restraint_specs(input_xml, support_config)
    xml_specs = base._build_explicit_restraint_specs(document.branches)
    explicit_specs = dtxr_specs if args.use_restraint_type_based_on_json else dict(xml_specs)
    if not args.use_restraint_type_based_on_json:
        for node_number, specs in dtxr_specs.items():
            explicit_specs[node_number] = patched._merge_specs(explicit_specs.get(node_number, tuple()), specs)
    model = patched._build_conversion_model(document, explicit_specs, patched._node_name_kind_map(document, node_number_kind_map))
    temperature_map, pressure_map = patched._branch_case_maps(document)
    base._build_restraint_payload = _direction_enabled_restraint_payload_factory(support_config)
    base._build_elements_payload = patched._patched_elements_payload_factory(temperature_map, pressure_map, insulation_density_map, hydro_pressure_map, support_config)  # type: ignore[assignment]
    base._build_sif_payload = _sif_payload_factory(tee_desc_by_node, support_config)  # type: ignore[assignment]
    cii_text = base._build_cii_text(model, args.coords_mode, base._resolve_template_version_line(args.template_cii), args.weight_scale, support_config)
    args.output.write_text(cii_text, encoding="utf-8")
    if args.diagnostics_out:
        args.diagnostics_out.write_text(base._build_diagnostics_report(model), encoding="utf-8")
    print(
        f"Wrote {args.output} with {len(model.edges)} elements and {len(model.restraints)} restraints. "
        f"use_restraint_type_based_on_json={args.use_restraint_type_based_on_json}; "
        f"split_condensed_valve_flange={support_config.get('splitCondensedValveFlange')}; "
        f"tee_sif_desc_nodes={len(tee_desc_by_node)}"
    )


install_direction_cosine_patch()


if __name__ == "__main__":
    main()
