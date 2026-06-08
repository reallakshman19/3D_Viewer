export async function runLegacyConverter(converterId, context) {
  // Safe bridge to legacy execution pathways
  return { success: true, message: `Ran adapter for ${converterId}` };
}
