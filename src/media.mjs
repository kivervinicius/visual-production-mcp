import { promises as fs, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.mkv']);
const MAX_MEDIA_BYTES = 4 * 1024 ** 3;

function assert(condition, message) { if (!condition) throw new Error(message); }

async function fileHash(file) {
  const hash = createHash('sha256');
  for await (const block of createReadStream(file)) hash.update(block);
  return hash.digest('hex');
}

function imageSignatureValid(extension, header) {
  if (extension === '.png') return header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (['.jpg', '.jpeg'].includes(extension)) return header.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  if (extension === '.webp') return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

async function metadata(file, extension) {
  if (IMAGE_EXTS.has(extension)) {
    const handle = await fs.open(file, 'r');
    try {
      const header = Buffer.alloc(12);
      await handle.read(header, 0, 12, 0);
      assert(imageSignatureValid(extension, header), 'File extension does not match a recognized image signature');
    } finally { await handle.close(); }
    return { kind: 'image', technicalValidation: 'signature-checked' };
  }
  assert(VIDEO_EXTS.has(extension), `Unsupported media format: ${extension}`);
  let output;
  try {
    output = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration,format_name:stream=codec_type,codec_name,width,height', '-of', 'json', file
    ], { maxBuffer: 1024 * 1024, timeout: 20000 });
  } catch (error) {
    throw new Error(`Video validation requires ffprobe and a readable video stream: ${String(error.message).slice(0,180)}`);
  }
  const probed = JSON.parse(output.stdout);
  const video = probed.streams?.find(s => s.codec_type === 'video');
  assert(video && Number.isInteger(video.width) && video.width > 0 && Number.isInteger(video.height) && video.height > 0, 'No valid video stream');
  return { kind: 'video', technicalValidation: 'ffprobe', durationSeconds: Number(probed.format?.duration || 0), width: video.width, height: video.height, codec: video.codec_name, format: probed.format?.format_name };
}

/** Import an existing provider output only. Never generates, downloads or modifies it. */
export async function ingestResult(studio, { jobId, filePath, externalJobId, expectedSha256 }) {
  assert(typeof jobId === 'string' && /^[0-9a-f-]{36}$/i.test(jobId), 'Invalid job ID');
  assert(typeof filePath === 'string' && filePath.length > 0, 'Local filePath required');
  const state = await studio.store.read();
  const job = state.jobs[jobId]; assert(job, 'Unknown job');
  assert(['submitted', 'complete'].includes(job.status), `Cannot ingest media for a job in ${job.status}; reconcile unknown submissions using the operator CLI first`);
  const file = await fs.realpath(path.resolve(filePath));
  const stat = await fs.stat(file);
  assert(stat.isFile() && stat.size > 0 && stat.size <= MAX_MEDIA_BYTES, 'Invalid or oversized media file');
  const ext = path.extname(file).toLowerCase();
  const details = await metadata(file, ext);
  const sha256 = await fileHash(file);
  if (expectedSha256) assert(expectedSha256 === sha256, 'Media digest mismatch');
  const destinationDir = path.join(studio.store.home, 'outputs', jobId);
  await fs.mkdir(destinationDir, { recursive: true, mode: 0o700 });
  const destination = path.join(destinationDir, `${sha256}${ext}`);
  try { await fs.copyFile(file, destination, fs.constants.COPYFILE_EXCL); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  assert((await fileHash(destination)) === sha256, 'Copied media failed integrity check');
  const receipt = { sha256, bytes: stat.size, storedPath: path.relative(studio.store.home, destination), importedAt: new Date().toISOString(), ...details };
  return studio.store.mutate(s => {
    const current = s.jobs[jobId]; assert(current, 'Unknown job');
    if (current.status === 'complete') {
      assert(current.receipt?.sha256 === sha256, 'Cannot replace an existing result; use a new variant');
      return { jobId, status: current.status, receipt: current.receipt, review: current.review, alreadyImported: true };
    }
    assert(current.status === 'submitted', `Job changed while ingesting: ${current.status}`);
    if (externalJobId) current.externalJobId = externalJobId;
    assert(current.externalJobId, 'Cannot complete without a provider job/operation ID');
    current.receipt = receipt;
    current.resultPath = destination;
    current.status = 'complete';
    current.review = 'pending'; // Cinematic and editorial QA must not be fabricated from ffprobe.
    current.updatedAt = new Date().toISOString();
    return { jobId, status: current.status, receipt, review: current.review, alreadyImported: false };
  });
}

/** Only a local operator can apply editorial approval/rejection, not an automated agent. */
export async function reviewResult(studio, { jobId, decision, note }) {
  assert(['approved', 'rejected'].includes(decision), 'Review must be approved or rejected');
  assert(note === undefined || (typeof note === 'string' && note.length <= 2000), 'Invalid review note');
  return studio.store.mutate(s => {
    const job = s.jobs[jobId]; assert(job?.status === 'complete' && job.receipt, 'Cannot review without verified media');
    job.review = decision; job.reviewNote = note || null; job.reviewedAt = new Date().toISOString();
    return { jobId, review: job.review, receipt: job.receipt };
  });
}