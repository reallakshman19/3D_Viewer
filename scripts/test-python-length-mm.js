const fs = require('fs');

const file1 = fs.readFileSync('viewer/converters/scripts/xml_to_cii2019_patched.py', 'utf8');
const file2 = fs.readFileSync('viewer/converters/scripts/xml_to_inputxml_debug.py', 'utf8');

if (file1.includes('_edge_length_mm') && file1.includes('math.sqrt(dx * dx + dy * dy + dz * dz)') && file1.includes('_apply_cii_vector_element_lengths_to_xml')) {
  console.log("xml_to_cii2019_patched.py updated successfully");
} else {
  console.error("xml_to_cii2019_patched.py missing expected changes");
}

if (file2.includes('math.sqrt(dx * dx + dy * dy + dz * dz)') && file2.includes('ELEMENT_LENGTH_MM')) {
  console.log("xml_to_inputxml_debug.py updated successfully");
} else {
  console.error("xml_to_inputxml_debug.py missing expected changes");
}
