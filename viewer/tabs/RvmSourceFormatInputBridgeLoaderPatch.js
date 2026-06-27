import { installRvmSourceToolsStagedJsonKindGateBridge } from './RvmSourceToolsStagedJsonKindGateBridge.js?v=20260627-rvm-source-tools-stagedjson-kind-gate-1';

export const RVM_SOURCE_FORMAT_INPUT_BRIDGE_LOADER_PATCH_SCHEMA = 'rvm-source-format-input-loader-patch/v1';

export function installRvmSourceFormatInputBridgeLoaderPatch() {
  return installRvmSourceToolsStagedJsonKindGateBridge();
}
