export const SAMPLE_RVM_CODE4_ELBOW_BINARY_NOTE = 'Synthetic code-4 decoder fixture only; not real AVEVA/RMSS/GAS compatibility evidence.';

export function createSampleRvmCode4ElbowBinaryV1() {
  const arrayBuffer = buildBinary();
  return {
    jobId: 'job-synthetic-rvm-code4-elbow-v1',
    kind: 'rvm-binary',
    fileName: 'synthetic-rvm-code4-elbow-v1.rvm',
    fileHash: 'sha256-synthetic-rvm-code4-elbow-v1',
    fileSize: arrayBuffer.byteLength,
    arrayBuffer,
    note: SAMPLE_RVM_CODE4_ELBOW_BINARY_NOTE,
  };
}

export function expectedSampleRvmCode4NativeParams() {
  return { radius: 0.25, bendRadius: 1.5, angleDeg: 90, sweepRadians: Math.PI / 2 };
}

function buildBinary() {
  const buffer = new ArrayBuffer(108);
  const view = new DataView(buffer);
  let offset = 0;
  writeTag(view, offset, 'CNTB');
  offset += 4;
  writePrimHeader(view, offset, 4, 88);
  offset += 12;
  writeF32Array(view, offset, identity());
  offset += 48;
  writeF32Array(view, offset, [0, 0, -0.25, 1.5, 1.5, 0.25]);
  offset += 24;
  writeF32Array(view, offset, [0.25, 1.5, 90, Math.PI / 2]);
  offset += 16;
  writeTag(view, offset, 'CNTE');
  return buffer;
}

function writePrimHeader(view, offset, code, payloadLength) {
  writeTag(view, offset, 'PRIM');
  view.setUint32(offset + 4, code, true);
  view.setUint32(offset + 8, payloadLength, true);
}

function writeTag(view, offset, tag) {
  for (let index = 0; index < 4; index += 1) view.setUint8(offset + index, tag.charCodeAt(index));
}

function writeF32Array(view, offset, values) {
  values.forEach((value, index) => view.setFloat32(offset + index * 4, value, true));
}

function identity() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
}
