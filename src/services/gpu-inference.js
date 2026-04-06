import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const GPU_PLATFORM_COMMISSION = 0.25; // 25% platform cut (GPU leasing carries infrastructure cost)
const GPU_PRIORITY_MULTIPLIERS = { low: 0.8, normal: 1.0, high: 1.4, urgent: 2.0 };
const GPU_BATCH_DISCOUNT       = 0.20; // 20% batch discount

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS gpu_jobs (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT NOT NULL,
    model_id            TEXT NOT NULL,
    priority            TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
    input_data          TEXT NOT NULL,
    input_tokens        INTEGER DEFAULT 0,
    output_data         TEXT,
    output_tokens       INTEGER DEFAULT 0,
    status              TEXT DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled')),
    queue_position      INTEGER,
    estimated_seconds   INTEGER,
    actual_seconds      REAL,
    base_price_usd      REAL DEFAULT 0,
    final_price_usd     REAL DEFAULT 0,
    commission_usd      REAL DEFAULT 0,
    gpu_type            TEXT,
    error_message       TEXT,
    created_at          TEXT DEFAULT (datetime('now')),
    started_at          TEXT,
    completed_at        TEXT
  );

  CREATE TABLE IF NOT EXISTS gpu_batch_jobs (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT NOT NULL,
    model_id            TEXT NOT NULL,
    priority            TEXT DEFAULT 'normal',
    item_count          INTEGER NOT NULL,
    success_count       INTEGER DEFAULT 0,
    failure_count       INTEGER DEFAULT 0,
    total_base_usd      REAL DEFAULT 0,
    total_final_usd     REAL DEFAULT 0,
    commission_usd      REAL DEFAULT 0,
    status              TEXT DEFAULT 'completed',
    created_at          TEXT DEFAULT (datetime('now')),
    completed_at        TEXT
  );
`);

// ─── Model Registry ───────────────────────────────────────────────────────────

const MODEL_REGISTRY = {
  "alphafold3": {
    name:         "AlphaFold 3",
    provider:     "Google DeepMind",
    category:     "bioinformatics",
    description:  "Protein structure prediction for arbitrary amino acid sequences.",
    price_per_inference_usd: 0.45,
    gpu_type:     "A100 80GB",
    avg_seconds:  45,
    input_unit:   "amino_acid_sequence",
    output_unit:  "3d_structure",
    max_input_tokens: 4096,
    example_output_keys: ["pdb_structure","confidence_plddt","predicted_aligned_error","chain_breaks"],
  },
  "stable-diffusion-xl": {
    name:         "Stable Diffusion XL",
    provider:     "Stability AI",
    category:     "image_generation",
    description:  "High-resolution (1024×1024) text-to-image generation.",
    price_per_inference_usd: 0.008,
    gpu_type:     "A10G",
    avg_seconds:  8,
    input_unit:   "prompt_tokens",
    output_unit:  "image_pixels",
    max_input_tokens: 77,
    example_output_keys: ["image_url","seed","cfg_scale","steps"],
  },
  "stable-video-diffusion": {
    name:         "Stable Video Diffusion",
    provider:     "Stability AI",
    category:     "video_generation",
    description:  "Generate short video clips (25 frames) from a single image or prompt.",
    price_per_inference_usd: 0.12,
    gpu_type:     "A100 40GB",
    avg_seconds:  30,
    input_unit:   "image_or_prompt",
    output_unit:  "video_frames",
    max_input_tokens: 256,
    example_output_keys: ["video_url","frame_count","fps","duration_seconds"],
  },
  "whisper-large-v3": {
    name:         "Whisper Large v3",
    provider:     "OpenAI",
    category:     "audio_transcription",
    description:  "High-accuracy multilingual speech-to-text transcription.",
    price_per_inference_usd: 0.006,
    gpu_type:     "A10G",
    avg_seconds:  5,
    input_unit:   "audio_seconds",
    output_unit:  "tokens",
    max_input_tokens: 30 * 60, // 30 minutes max
    example_output_keys: ["transcript","language","segments","word_timestamps"],
  },
  "codellama-70b": {
    name:         "Code Llama 70B",
    provider:     "Meta",
    category:     "code_generation",
    description:  "State-of-the-art code generation, completion, and infilling for 40+ languages.",
    price_per_inference_usd: 0.0009,
    gpu_type:     "A100 80GB ×4",
    avg_seconds:  12,
    input_unit:   "tokens",
    output_unit:  "tokens",
    max_input_tokens: 100000,
    example_output_keys: ["generated_code","language","completion_tokens","stop_reason"],
  },
  "llama3.1-405b": {
    name:         "Llama 3.1 405B",
    provider:     "Meta",
    category:     "llm",
    description:  "Meta's largest open-weights LLM — frontier-class reasoning and instruction following.",
    price_per_inference_usd: 0.003,
    gpu_type:     "H100 80GB ×8",
    avg_seconds:  20,
    input_unit:   "tokens",
    output_unit:  "tokens",
    max_input_tokens: 128000,
    example_output_keys: ["choices","usage","model","finish_reason"],
  },
  "flux-pro-1.1": {
    name:         "FLUX.1 Pro",
    provider:     "Black Forest Labs",
    category:     "image_generation",
    description:  "Top-tier photorealistic image generation with prompt adherence.",
    price_per_inference_usd: 0.055,
    gpu_type:     "H100 80GB",
    avg_seconds:  15,
    input_unit:   "prompt_tokens",
    output_unit:  "image_pixels",
    max_input_tokens: 512,
    example_output_keys: ["image_url","width","height","seed"],
  },
  "musicgen-large": {
    name:         "MusicGen Large",
    provider:     "Meta",
    category:     "audio_generation",
    description:  "High-quality music generation from text prompts — up to 30 seconds.",
    price_per_inference_usd: 0.02,
    gpu_type:     "A100 40GB",
    avg_seconds:  25,
    input_unit:   "prompt_tokens",
    output_unit:  "audio_seconds",
    max_input_tokens: 256,
    example_output_keys: ["audio_url","duration_seconds","sample_rate","format"],
  },
  "segment-anything-2": {
    name:         "Segment Anything 2",
    provider:     "Meta",
    category:     "computer_vision",
    description:  "Zero-shot image and video segmentation with prompt-based mask generation.",
    price_per_inference_usd: 0.015,
    gpu_type:     "A10G",
    avg_seconds:  4,
    input_unit:   "image_pixels",
    output_unit:  "mask_pixels",
    max_input_tokens: null,
    example_output_keys: ["masks","scores","logits","iou_predictions"],
  },
  "deepseek-r1-671b": {
    name:         "DeepSeek R1 671B",
    provider:     "DeepSeek AI",
    category:     "reasoning_llm",
    description:  "Chain-of-thought reasoning model — math, science, code, and complex analysis.",
    price_per_inference_usd: 0.0015,
    gpu_type:     "H100 80GB ×8",
    avg_seconds:  35,
    input_unit:   "tokens",
    output_unit:  "tokens",
    max_input_tokens: 64000,
    example_output_keys: ["thinking","response","usage","finish_reason"],
  },
  "xtts-v2": {
    name:         "XTTS v2",
    provider:     "Coqui AI",
    category:     "text_to_speech",
    description:  "Zero-shot multilingual voice cloning and text-to-speech synthesis.",
    price_per_inference_usd: 0.004,
    gpu_type:     "A10G",
    avg_seconds:  6,
    input_unit:   "characters",
    output_unit:  "audio_seconds",
    max_input_tokens: 2000,
    example_output_keys: ["audio_url","duration_seconds","voice_id","language"],
  },
  "yolo-v10-xl": {
    name:         "YOLOv10-XL",
    provider:     "Tsinghua University",
    category:     "object_detection",
    description:  "Real-time multi-object detection and classification from images or video frames.",
    price_per_inference_usd: 0.003,
    gpu_type:     "T4",
    avg_seconds:  2,
    input_unit:   "image_pixels",
    output_unit:  "detections",
    max_input_tokens: null,
    example_output_keys: ["detections","labels","scores","bounding_boxes"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateTokens(input) {
  const str = typeof input === "string" ? input : JSON.stringify(input ?? "");
  return Math.max(1, Math.ceil(str.length / 4));
}

function simulateInferenceOutput(modelId, input) {
  const model = MODEL_REGISTRY[modelId];
  const inputStr = typeof input === "string" ? input : JSON.stringify(input);

  const outputs = {
    "alphafold3":             { pdb_structure: `ATOM      1  N   MET A   1    ...`, confidence_plddt: Math.round((85 + Math.random() * 14) * 10) / 10, predicted_aligned_error: Math.round(Math.random() * 5 * 10) / 10, chain_breaks: 0 },
    "stable-diffusion-xl":    { image_url: `https://cdn.agentbay.io/generated/${uuid()}.png`, seed: Math.floor(Math.random() * 2**32), cfg_scale: 7.5, steps: 30, width: 1024, height: 1024 },
    "stable-video-diffusion": { video_url: `https://cdn.agentbay.io/generated/${uuid()}.mp4`, frame_count: 25, fps: 8, duration_seconds: 3.125 },
    "whisper-large-v3":       { transcript: `Transcribed text from: "${inputStr.slice(0, 60)}..."`, language: "en", confidence: 0.97, word_count: Math.floor(50 + Math.random() * 200), segments: [{ start: 0.0, end: 4.2, text: "Audio segment transcribed successfully." }] },
    "codellama-70b":          { generated_code: `// Code Llama output for: ${inputStr.slice(0, 40)}\nfunction solution(input) {\n  // Implementation\n  return processInput(input);\n}`, language: "javascript", completion_tokens: Math.floor(50 + Math.random() * 400), stop_reason: "stop" },
    "llama3.1-405b":          { choices: [{ message: { role: "assistant", content: `Response to: "${inputStr.slice(0, 60)}..."` }, finish_reason: "stop" }], usage: { prompt_tokens: estimateTokens(input), completion_tokens: Math.floor(50 + Math.random() * 500), total_tokens: 0 } },
    "flux-pro-1.1":           { image_url: `https://cdn.agentbay.io/generated/${uuid()}.png`, width: 1440, height: 1440, seed: Math.floor(Math.random() * 2**32) },
    "musicgen-large":         { audio_url: `https://cdn.agentbay.io/generated/${uuid()}.wav`, duration_seconds: 15 + Math.random() * 15, sample_rate: 32000, format: "wav" },
    "segment-anything-2":     { masks: [[1, 0, 1], [0, 1, 0]], scores: [0.98, 0.91], iou_predictions: [0.97, 0.89], mask_count: 2 },
    "deepseek-r1-671b":       { thinking: "Let me analyze this step by step...", response: `Detailed reasoning response for: "${inputStr.slice(0, 60)}..."`, usage: { prompt_tokens: estimateTokens(input), completion_tokens: Math.floor(100 + Math.random() * 800) }, finish_reason: "stop" },
    "xtts-v2":                { audio_url: `https://cdn.agentbay.io/generated/${uuid()}.wav`, duration_seconds: Math.ceil(inputStr.length / 15), voice_id: `voice_${uuid().slice(0, 8)}`, language: "en", sample_rate: 24000 },
    "yolo-v10-xl":            { detections: [{ label: "person", score: 0.97, box: [42, 78, 234, 512] }, { label: "laptop", score: 0.89, box: [300, 200, 480, 350] }], detection_count: 2, inference_ms: Math.floor(20 + Math.random() * 80) },
  };

  const output = outputs[modelId] ?? { result: "Inference completed", model: model?.name, input_preview: inputStr.slice(0, 100) };

  // Fix llama total_tokens
  if (modelId === "llama3.1-405b" && output.choices) {
    output.usage.total_tokens = output.usage.prompt_tokens + output.usage.completion_tokens;
  }
  if (modelId === "deepseek-r1-671b" && output.usage) {
    output.usage.total_tokens = output.usage.prompt_tokens + output.usage.completion_tokens;
  }

  return output;
}

// ─── Request Inference ────────────────────────────────────────────────────────

/**
 * Submit an inference job to an ephemeral GPU worker.
 * @param {string}       modelId  - Model ID from listAvailableModels()
 * @param {string|object} input   - Input data (prompt, sequence, audio URL, image URL, etc.)
 * @param {string}       priority - "low" | "normal" | "high" | "urgent"
 * @returns Job record with ID, queue position, and estimated completion time
 */
export function requestInference(modelId, input, priority = "normal") {
  if (!modelId) throw new Error("modelId is required");
  if (!input)   throw new Error("input is required");

  const validPriorities = ["low","normal","high","urgent"];
  if (!validPriorities.includes(priority)) throw new Error(`priority must be one of: ${validPriorities.join(", ")}`);

  const model = MODEL_REGISTRY[modelId];
  if (!model) throw new Error(`Unknown model: "${modelId}". Call listAvailableModels() for available models.`);

  const inputTokens = estimateTokens(input);
  if (model.max_input_tokens && inputTokens > model.max_input_tokens) {
    throw new Error(`Input too large: ${inputTokens} tokens exceeds model limit of ${model.max_input_tokens} tokens.`);
  }

  const agentId        = `agent_${uuid().slice(0, 8)}`;
  const jobId          = uuid();
  const priorityMult   = GPU_PRIORITY_MULTIPLIERS[priority] ?? 1.0;
  const basePrice      = Math.round(model.price_per_inference_usd * 100) / 100;
  const finalPrice     = Math.round(basePrice * priorityMult * 100) / 100;
  const commission     = Math.round(finalPrice * GPU_PLATFORM_COMMISSION * 100) / 100;
  const queuePosition  = priority === "urgent" ? 1 : priority === "high" ? Math.floor(1 + Math.random() * 3) : Math.floor(3 + Math.random() * 10);
  const estSeconds     = Math.ceil(model.avg_seconds * (priority === "urgent" ? 0.5 : priority === "high" ? 0.75 : 1.0));
  const now            = new Date().toISOString();
  const estimatedAt    = new Date(Date.now() + estSeconds * 1000).toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO gpu_jobs
      (id, agent_id, model_id, priority, input_data, input_tokens, status,
       queue_position, estimated_seconds, base_price_usd, final_price_usd, commission_usd, gpu_type, created_at)
    VALUES
      (@id, @agent_id, @model_id, @priority, @input_data, @input_tokens, @status,
       @queue_position, @estimated_seconds, @base_price_usd, @final_price_usd, @commission_usd, @gpu_type, @created_at)
  `).run({
    id: jobId, agent_id: agentId, model_id: modelId, priority,
    input_data:        typeof input === "string" ? input : JSON.stringify(input),
    input_tokens:      inputTokens,
    status:            "queued",
    queue_position:    queuePosition,
    estimated_seconds: estSeconds,
    base_price_usd:    basePrice,
    final_price_usd:   finalPrice,
    commission_usd:    commission,
    gpu_type:          model.gpu_type,
    created_at:        now,
  });

  return {
    job_id:               jobId,
    agent_id:             agentId,
    model_id:             modelId,
    model_name:           model.name,
    model_category:       model.category,
    priority,
    status:               "queued",
    queue_position:       queuePosition,
    gpu_type:             model.gpu_type,
    input_tokens:         inputTokens,
    estimated_seconds:    estSeconds,
    estimated_completion_at: estimatedAt,
    base_price_usd:       basePrice,
    priority_multiplier:  priorityMult,
    final_price_usd:      finalPrice,
    platform_commission_usd: commission,
    provider_payout_usd:  Math.round((finalPrice - commission) * 100) / 100,
    created_at:           now,
    message:              `Job queued at position #${queuePosition}. Estimated completion in ~${estSeconds}s. Use getInferenceResult("${jobId}") to retrieve output.`,
  };
}

// ─── Get Inference Result ─────────────────────────────────────────────────────

/**
 * Retrieve the result of a submitted inference job.
 * @param {string} jobId - Job ID from requestInference()
 * @returns Completed inference output or current status if still running
 */
export function getInferenceResult(jobId) {
  if (!jobId) throw new Error("jobId is required");

  const job = db.prepare("SELECT * FROM gpu_jobs WHERE id = ?").get(jobId);
  if (!job) throw new Error(`Inference job not found: ${jobId}`);

  const model       = MODEL_REGISTRY[job.model_id];
  const createdMs   = new Date(job.created_at).getTime();
  const elapsedSec  = (Date.now() - createdMs) / 1000;
  const isComplete  = elapsedSec >= (job.estimated_seconds ?? 30);

  // Simulate status progression
  let simulatedStatus = job.status;
  if (job.status === "queued"   && elapsedSec > 2)                   simulatedStatus = "running";
  if (job.status === "running"  && isComplete)                       simulatedStatus = "completed";
  if ((job.status === "queued") && isComplete)                       simulatedStatus = "completed";

  if (simulatedStatus !== job.status && !["completed","failed","cancelled"].includes(job.status)) {
    if (simulatedStatus === "running") {
      db.prepare("UPDATE gpu_jobs SET status = 'running', started_at = datetime('now') WHERE id = ?").run(jobId);
    }
    if (simulatedStatus === "completed") {
      const output       = simulateInferenceOutput(job.model_id, job.input_data);
      const outputTokens = estimateTokens(output);
      const actualSec    = job.estimated_seconds * (0.8 + Math.random() * 0.4);
      const completedAt  = new Date().toISOString();

      db.prepare(`
        UPDATE gpu_jobs SET
          status = 'completed', output_data = @output, output_tokens = @output_tokens,
          actual_seconds = @actual_seconds, completed_at = @completed_at
        WHERE id = @id
      `).run({ id: jobId, output: JSON.stringify(output), output_tokens: outputTokens, actual_seconds: Math.round(actualSec * 100) / 100, completed_at: completedAt });

      return {
        job_id:         jobId,
        model_id:       job.model_id,
        model_name:     model?.name,
        status:         "completed",
        priority:       job.priority,
        output:         output,
        input_tokens:   job.input_tokens,
        output_tokens:  outputTokens,
        actual_seconds: Math.round(actualSec * 100) / 100,
        gpu_type:       job.gpu_type,
        final_price_usd:    job.final_price_usd,
        platform_commission_usd: job.commission_usd,
        completed_at:   completedAt,
      };
    }
  }

  if (job.status === "completed" && job.output_data) {
    return {
      job_id:        jobId,
      model_id:      job.model_id,
      model_name:    model?.name,
      status:        "completed",
      priority:      job.priority,
      output:        JSON.parse(job.output_data),
      input_tokens:  job.input_tokens,
      output_tokens: job.output_tokens,
      actual_seconds: job.actual_seconds,
      gpu_type:      job.gpu_type,
      final_price_usd:    job.final_price_usd,
      platform_commission_usd: job.commission_usd,
      completed_at:  job.completed_at,
    };
  }

  // Still running
  const progress = Math.min(95, Math.round((elapsedSec / Math.max(job.estimated_seconds, 1)) * 100));
  return {
    job_id:                  jobId,
    model_id:                job.model_id,
    model_name:              model?.name,
    status:                  simulatedStatus,
    priority:                job.priority,
    queue_position:          simulatedStatus === "running" ? null : job.queue_position,
    progress_pct:            progress,
    estimated_seconds_remaining: Math.max(0, Math.round(job.estimated_seconds - elapsedSec)),
    gpu_type:                job.gpu_type,
    final_price_usd:         job.final_price_usd,
    created_at:              job.created_at,
    message:                 simulatedStatus === "running"
      ? `Inference running on ${job.gpu_type}. ${progress}% complete.`
      : `Job queued at position #${job.queue_position}. Waiting for GPU allocation.`,
  };
}

// ─── List Available Models ────────────────────────────────────────────────────

/**
 * List all available GPU inference models with pricing and capability info.
 * @returns Full model catalog with per-inference pricing
 */
export function listAvailableModels() {
  const categories = {};
  for (const [id, m] of Object.entries(MODEL_REGISTRY)) {
    if (!categories[m.category]) categories[m.category] = [];
    categories[m.category].push({
      model_id:                    id,
      name:                        m.name,
      provider:                    m.provider,
      category:                    m.category,
      description:                 m.description,
      gpu_type:                    m.gpu_type,
      avg_latency_seconds:         m.avg_seconds,
      max_input_tokens:            m.max_input_tokens,
      input_unit:                  m.input_unit,
      output_unit:                 m.output_unit,
      price_per_inference_usd:     m.price_per_inference_usd,
      price_high_priority_usd:     Math.round(m.price_per_inference_usd * GPU_PRIORITY_MULTIPLIERS.high    * 1000) / 1000,
      price_urgent_priority_usd:   Math.round(m.price_per_inference_usd * GPU_PRIORITY_MULTIPLIERS.urgent  * 1000) / 1000,
      price_low_priority_usd:      Math.round(m.price_per_inference_usd * GPU_PRIORITY_MULTIPLIERS.low     * 1000) / 1000,
      example_output_keys:         m.example_output_keys,
    });
  }

  return {
    models:                    Object.values(MODEL_REGISTRY).map((m, i) => ({
      model_id:                Object.keys(MODEL_REGISTRY)[i],
      name:                    m.name,
      provider:                m.provider,
      category:                m.category,
      description:             m.description,
      gpu_type:                m.gpu_type,
      avg_latency_seconds:     m.avg_seconds,
      price_per_inference_usd: m.price_per_inference_usd,
    })),
    by_category:               categories,
    model_count:               Object.keys(MODEL_REGISTRY).length,
    priority_multipliers:      GPU_PRIORITY_MULTIPLIERS,
    batch_discount_pct:        GPU_BATCH_DISCOUNT * 100,
    platform_commission_rate:  GPU_PLATFORM_COMMISSION,
  };
}

// ─── Estimate Inference Cost ──────────────────────────────────────────────────

/**
 * Get a price estimate for a given model and input size before committing.
 * @param {string} modelId    - Model ID
 * @param {number} inputSize  - Input size in tokens (or characters for TTS)
 * @returns Price breakdown for all priority levels
 */
export function estimateInferenceCost(modelId, inputSize) {
  if (!modelId)   throw new Error("modelId is required");
  if (inputSize == null || inputSize < 1) throw new Error("inputSize must be a positive number");

  const model = MODEL_REGISTRY[modelId];
  if (!model) throw new Error(`Unknown model: "${modelId}". Call listAvailableModels() for available models.`);

  if (model.max_input_tokens && inputSize > model.max_input_tokens) {
    throw new Error(`inputSize ${inputSize} exceeds model maximum of ${model.max_input_tokens} ${model.input_unit}.`);
  }

  const base = model.price_per_inference_usd;

  return {
    model_id:      modelId,
    model_name:    model.name,
    provider:      model.provider,
    category:      model.category,
    gpu_type:      model.gpu_type,
    input_size:    inputSize,
    input_unit:    model.input_unit,
    pricing: {
      low:    { price_usd: Math.round(base * GPU_PRIORITY_MULTIPLIERS.low    * 100) / 100, multiplier: GPU_PRIORITY_MULTIPLIERS.low,    est_seconds: Math.ceil(model.avg_seconds * 1.5)  },
      normal: { price_usd: Math.round(base * GPU_PRIORITY_MULTIPLIERS.normal * 100) / 100, multiplier: GPU_PRIORITY_MULTIPLIERS.normal, est_seconds: model.avg_seconds                  },
      high:   { price_usd: Math.round(base * GPU_PRIORITY_MULTIPLIERS.high   * 100) / 100, multiplier: GPU_PRIORITY_MULTIPLIERS.high,   est_seconds: Math.ceil(model.avg_seconds * 0.75) },
      urgent: { price_usd: Math.round(base * GPU_PRIORITY_MULTIPLIERS.urgent * 100) / 100, multiplier: GPU_PRIORITY_MULTIPLIERS.urgent, est_seconds: Math.ceil(model.avg_seconds * 0.5)  },
    },
    platform_commission_rate: GPU_PLATFORM_COMMISSION,
    note: `Prices are per-inference. Batch processing (batchInference) applies a ${GPU_BATCH_DISCOUNT * 100}% discount.`,
  };
}

// ─── Batch Inference ──────────────────────────────────────────────────────────

/**
 * Submit multiple inputs for inference in a single batch job (20% discount).
 * @param {string}         modelId  - Model ID
 * @param {Array}          inputs   - Array of inputs to process
 * @param {string}         priority - "low" | "normal" | "high" | "urgent"
 * @returns Batch job with all results and aggregate pricing
 */
export function batchInference(modelId, inputs, priority = "normal") {
  if (!modelId)                                          throw new Error("modelId is required");
  if (!Array.isArray(inputs) || inputs.length === 0)     throw new Error("inputs must be a non-empty array");
  if (inputs.length > 500)                               throw new Error("Batch size limit is 500 inputs per job");

  const validPriorities = ["low","normal","high","urgent"];
  if (!validPriorities.includes(priority)) throw new Error(`priority must be one of: ${validPriorities.join(", ")}`);

  const model = MODEL_REGISTRY[modelId];
  if (!model) throw new Error(`Unknown model: "${modelId}". Call listAvailableModels() for available models.`);

  const agentId      = `agent_${uuid().slice(0, 8)}`;
  const batchId      = uuid();
  const priorityMult = GPU_PRIORITY_MULTIPLIERS[priority] ?? 1.0;
  const unitBase     = model.price_per_inference_usd;
  const unitFinal    = Math.round(unitBase * priorityMult * (1 - GPU_BATCH_DISCOUNT) * 10000) / 10000;
  const now          = new Date().toISOString();

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const input of inputs) {
    try {
      const inputTokens  = estimateTokens(input);
      if (model.max_input_tokens && inputTokens > model.max_input_tokens) {
        results.push({ success: false, error: `Input too large (${inputTokens} > ${model.max_input_tokens} tokens)`, output: null });
        failureCount++;
        continue;
      }
      const output       = simulateInferenceOutput(modelId, input);
      const outputTokens = estimateTokens(output);
      results.push({ success: true, output, input_tokens: inputTokens, output_tokens: outputTokens });
      successCount++;
    } catch (e) {
      results.push({ success: false, error: e.message, output: null });
      failureCount++;
    }
  }

  const totalBase  = Math.round(inputs.length * unitBase  * priorityMult * 100) / 100;
  const totalFinal = Math.round(inputs.length * unitFinal * 100) / 100;
  const commission = Math.round(totalFinal * GPU_PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO gpu_batch_jobs
      (id, agent_id, model_id, priority, item_count, success_count, failure_count,
       total_base_usd, total_final_usd, commission_usd, status, created_at, completed_at)
    VALUES
      (@id, @agent_id, @model_id, @priority, @item_count, @success_count, @failure_count,
       @total_base_usd, @total_final_usd, @commission_usd, @status, @created_at, @completed_at)
  `).run({
    id: batchId, agent_id: agentId, model_id: modelId, priority,
    item_count:      inputs.length,
    success_count:   successCount,
    failure_count:   failureCount,
    total_base_usd:  totalBase,
    total_final_usd: totalFinal,
    commission_usd:  commission,
    status:          failureCount === 0 ? "completed" : successCount === 0 ? "failed" : "partial",
    created_at:      now,
    completed_at:    now,
  });

  return {
    batch_id:              batchId,
    agent_id:              agentId,
    model_id:              modelId,
    model_name:            model.name,
    priority,
    item_count:            inputs.length,
    success_count:         successCount,
    failure_count:         failureCount,
    results,
    unit_base_price_usd:   unitBase,
    unit_final_price_usd:  unitFinal,
    batch_discount_pct:    GPU_BATCH_DISCOUNT * 100,
    priority_multiplier:   priorityMult,
    total_base_usd:        totalBase,
    total_final_usd:       totalFinal,
    savings_usd:           Math.round((totalBase - totalFinal) * 100) / 100,
    platform_commission_usd: commission,
    status:                failureCount === 0 ? "completed" : successCount === 0 ? "failed" : "partial",
    completed_at:          now,
  };
}
