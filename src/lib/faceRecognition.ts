import type { Student, FacialRecognitionResult } from "../types";
import { chooseFaceMatch, descriptorDistance } from "./faceMatching";

type FaceApi = typeof import("@vladmandic/face-api");

let faceApiPromise: Promise<FaceApi> | null = null;
let modelsPromise: Promise<FaceApi> | null = null;
const descriptorCache = new Map<string, { source: string; result: Promise<Float32Array | null> }>();
// Serialize GPU work so roster preparation cannot flood the device or overlap a scan.
let inferenceTail: Promise<unknown> = Promise.resolve();
function infer<T>(work: () => Promise<T>): Promise<T> {
  const result = inferenceTail.then(work);
  inferenceTail = result.catch(() => {});
  return result;
}
export function clearFaceRecognitionCache() { descriptorCache.clear(); }

const MODEL_PATH = "/models";


async function getFaceApi(): Promise<FaceApi> {
  if (!faceApiPromise) {
    faceApiPromise = import("@vladmandic/face-api").catch(error => { faceApiPromise = null; throw error; });
  }

  return faceApiPromise;
}

async function loadModels(): Promise<FaceApi> {
  if (!modelsPromise) {
    modelsPromise = getFaceApi().then(async (faceapi) => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_PATH),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH),
      ]);
      return faceapi;
    }).catch(error => { modelsPromise = null; throw error; });
  }

  return modelsPromise;
}

function getDetectorOptions(faceapi: FaceApi) {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5,
  });
}

async function imageFromSource(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => { image.src = ""; reject(new Error("Face image took too long to load.")); }, 10000);
    image.onload = () => { window.clearTimeout(timer); resolve(); };
    image.onerror = () => { window.clearTimeout(timer); reject(new Error("Face image could not be loaded.")); };
    image.src = source;
  });
  return image;
}

export async function validateEnrollmentPhoto(source: string): Promise<Float32Array> {
  const faceapi = await loadModels();
  const image = await imageFromSource(source);
  const results = await infer(async () => await faceapi.detectAllFaces(image, getDetectorOptions(faceapi))
    .withFaceLandmarks().withFaceDescriptors());
  if (results.length !== 1) throw new Error(results.length
    ? "Use a photo with exactly one person in the frame."
    : "No clear face detected. Use a well-lit, front-facing photo.");
  return results[0].descriptor;
}

async function descriptorForStudent(student: Student): Promise<Float32Array | null> {
  if (!student.faceImageDataUrl) return null;
  const cached = descriptorCache.get(student.id);
  if (cached?.source === student.faceImageDataUrl) return cached.result;
  const result = validateEnrollmentPhoto(student.faceImageDataUrl).catch(() => {
    // A failed remote image may succeed on retry; do not cache failures indefinitely.
    if (descriptorCache.get(student.id)?.result === result) descriptorCache.delete(student.id);
    return null;
  });
  if (descriptorCache.size >= 500) descriptorCache.delete(descriptorCache.keys().next().value!);
  descriptorCache.set(student.id, { source: student.faceImageDataUrl, result });
  return result;
}

export async function warmFaceRecognition(students: Student[]): Promise<void> {
  await loadModels();
  const active = students.filter(student => student.status === "active");
  const ids = new Set(active.map(student => student.id));
  for (const id of descriptorCache.keys()) if (!ids.has(id)) descriptorCache.delete(id);
  // Yield between templates to keep controls responsive on slower devices.
  for (const student of active) {
    await descriptorForStudent(student);
    await new Promise(resolve => window.setTimeout(resolve, 0));
  }
}

export async function recognizeFaceFromDataUrl(
  captureBase64: string | HTMLCanvasElement,
  students: Student[],
): Promise<FacialRecognitionResult> {
  const faceapi = await loadModels();
  const image = typeof captureBase64 === "string" ? await imageFromSource(captureBase64) : captureBase64;
  const liveResults = await infer(async () => await faceapi
    .detectAllFaces(image, getDetectorOptions(faceapi))
    .withFaceLandmarks()
    .withFaceDescriptors());

  if (liveResults.length !== 1) {
    return {
      matched: false,
      confidence: 0,
      verificationNotes: liveResults.length ? "Multiple faces detected. Only one person should be in the frame." : "No face detected. Move into the frame and improve the lighting.",
    };
  }

  const liveResult = liveResults[0];
  const candidates = await Promise.all(
    students
      .filter((student) => student.status === "active")
      .map(async (student) => ({
        student,
        descriptor: await descriptorForStudent(student),
      })),
  );

  const closest = chooseFaceMatch(candidates
    .filter((candidate): candidate is { student: Student; descriptor: Float32Array } => Boolean(candidate.descriptor))
    .map((candidate) => ({
      ...candidate,
      distance: descriptorDistance(liveResult.descriptor, candidate.descriptor),
    }))
  );

  if (!closest) {
    return {
      matched: false,
      confidence: 0,
      verificationNotes: "No unambiguous match. Center your face in good lighting or ask for manual check-in.",
    };
  }

  const confidence = Math.max(0, Math.min(100, (1 - closest.distance) * 100));
  return {
    matched: true,
    confidence: Math.round(confidence * 10) / 10,
    studentId: closest.student.id,
    studentName: closest.student.name,
    rollNumber: closest.student.rollNumber,
    className: closest.student.className,
    verificationNotes: `On-device match: ${Math.round(confidence)}% similarity. This score is not a probability of identity.`,
  };
}
