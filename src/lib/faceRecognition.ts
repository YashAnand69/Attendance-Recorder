import type { Student, FacialRecognitionResult } from "../types";

type FaceApi = typeof import("@vladmandic/face-api");

let faceApiPromise: Promise<FaceApi> | null = null;
let modelsPromise: Promise<FaceApi> | null = null;
const descriptorCache = new Map<string, Float32Array>();

const MODEL_PATH = "/models";
const MATCH_THRESHOLD = 0.55;

async function getFaceApi(): Promise<FaceApi> {
  if (!faceApiPromise) {
    faceApiPromise = import("@vladmandic/face-api");
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
    });
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
  image.src = source;
  try {
    await image.decode();
  } catch {
    if (!image.complete || image.naturalWidth === 0) throw new Error("Face image could not be loaded.");
  }
  return image;
}

async function descriptorForStudent(faceapi: FaceApi, student: Student): Promise<Float32Array | null> {
  if (!student.faceImageDataUrl) return null;

  const cacheKey = `${student.id}:${student.faceImageDataUrl}`;
  const cached = descriptorCache.get(cacheKey);
  if (cached) return cached;

  try {
    const image = await imageFromSource(student.faceImageDataUrl);
    const result = await faceapi
      .detectSingleFace(image, getDetectorOptions(faceapi))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) return null;

    descriptorCache.set(cacheKey, result.descriptor);
    return result.descriptor;
  } catch (error) {
    console.warn(`Could not create a face template for ${student.name}:`, error);
    return null;
  }
}

function euclideanDistance(first: Float32Array, second: Float32Array): number {
  let sum = 0;
  for (let index = 0; index < first.length; index += 1) {
    const difference = first[index] - second[index];
    sum += difference * difference;
  }
  return Math.sqrt(sum);
}

export async function warmFaceRecognition(students: Student[]): Promise<void> {
  const faceapi = await loadModels();
  await Promise.all(students.slice(0, 30).map((student) => descriptorForStudent(faceapi, student)));
}

export async function recognizeFaceFromDataUrl(
  captureBase64: string,
  students: Student[],
): Promise<FacialRecognitionResult> {
  const faceapi = await loadModels();
  const image = await imageFromSource(captureBase64);
  const liveResult = await faceapi
    .detectSingleFace(image, getDetectorOptions(faceapi))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!liveResult) {
    return {
      matched: false,
      confidence: 0,
      verificationNotes: "No face detected. Move into the reticle and improve the lighting.",
    };
  }

  const candidates = await Promise.all(
    students
      .filter((student) => student.status === "active")
      .slice(0, 30)
      .map(async (student) => ({
        student,
        descriptor: await descriptorForStudent(faceapi, student),
      })),
  );

  const closest = candidates
    .filter((candidate): candidate is { student: Student; descriptor: Float32Array } => Boolean(candidate.descriptor))
    .map((candidate) => ({
      ...candidate,
      distance: euclideanDistance(liveResult.descriptor, candidate.descriptor),
    }))
    .sort((first, second) => first.distance - second.distance)[0];

  if (!closest || closest.distance > MATCH_THRESHOLD) {
    return {
      matched: false,
      confidence: Math.max(0, Math.round((1 - Math.min(closest?.distance ?? 1, 1)) * 100)),
      verificationNotes: "Face detected, but no enrolled student passed the match threshold.",
    };
  }

  const confidence = Math.min(99.9, Math.max(75, (1 - closest.distance / MATCH_THRESHOLD) * 25 + 75));
  return {
    matched: true,
    confidence: Math.round(confidence * 10) / 10,
    studentId: closest.student.id,
    studentName: closest.student.name,
    rollNumber: closest.student.rollNumber,
    className: closest.student.className,
    verificationNotes: `On-device face match verified at ${Math.round(confidence)}% confidence.`,
  };
}
