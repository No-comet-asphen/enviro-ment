// backend/src/services/clarification.service.ts

export interface ClarificationQuestion {
  id: string;
  question: string;
  input_type: "single_select" | "multi_select" | "text";
  options?: string[];
}

export interface ClarifyReportInput {
  description: string;
  location?: {
    name?: string;
    latitude?: number;
    longitude?: number;
  };
  answers?: Array<{ question_id: string; answer: string | string[] }>;
}

export function handleClarifyReport(input: ClarifyReportInput) {
  const d = (input.description || "").toLowerCase();
  const answers = input.answers || [];

  // Determine category
  let detected_category = "general_concern";
  if (d.includes("water") || d.includes("tap") || d.includes("drink")) {
    detected_category = d.includes("dirty") || d.includes("smell") || d.includes("taste") || d.includes("color")
      ? "water_quality"
      : "water_supply";
  } else if (d.includes("air") || d.includes("smog") || d.includes("smoke") || d.includes("aqi") || d.includes("dust")) {
    detected_category = "air_pollution";
  } else if (d.includes("waste") || d.includes("dump") || d.includes("garbage")) {
    detected_category = "waste_accumulation";
  } else if (d.includes("noise") || d.includes("loud") || d.includes("sound")) {
    detected_category = "noise_pollution";
  }

  // If user has already answered questions, or description has sufficient details
  if (answers.length >= 2 || (d.length > 80 && input.location?.name)) {
    return {
      is_ready: true,
      detected_category,
      questions: []
    };
  }

  const questions: ClarificationQuestion[] = [];

  if (detected_category === "water_quality") {
    questions.push({
      id: "water_source",
      question: "Is this tap water, borewell water or another source?",
      input_type: "single_select",
      options: ["tap", "borewell", "other", "unknown"]
    });
    questions.push({
      id: "observation",
      question: "What did you notice?",
      input_type: "multi_select",
      options: ["unusual_colour", "unusual_smell", "visible_particles", "unusual_taste", "other"]
    });
  } else if (detected_category === "water_supply") {
    questions.push({
      id: "outage_scope",
      question: "Does this outage affect a single building or the entire street/neighborhood?",
      input_type: "single_select",
      options: ["single_building", "street_cluster", "entire_sector", "unknown"]
    });
    questions.push({
      id: "outage_duration",
      question: "How long has the water supply been disrupted?",
      input_type: "single_select",
      options: ["less_than_4_hours", "4_to_12_hours", "more_than_24_hours", "intermittent"]
    });
  } else if (detected_category === "air_pollution") {
    questions.push({
      id: "apparent_source",
      question: "Can you identify any suspected source of the emission?",
      input_type: "single_select",
      options: ["construction_dust", "crop_or_waste_burning", "industrial_stack", "vehicular_traffic", "unknown"]
    });
    questions.push({
      id: "sensory_impact",
      question: "Are residents experiencing throat irritation, reduced visibility or foul odors?",
      input_type: "multi_select",
      options: ["low_visibility", "eye_irritation", "pungent_odor", "difficulty_breathing"]
    });
  } else {
    questions.push({
      id: "incident_timing",
      question: "Is this problem actively occurring right now or recurring periodically?",
      input_type: "single_select",
      options: ["happening_now", "recurring_daily", "intermittent", "past_event"]
    });
    questions.push({
      id: "affected_area",
      question: "What is the approximate extent of the affected zone?",
      input_type: "single_select",
      options: ["localized_point", "neighborhood_block", "ward_level", "unknown"]
    });
  }

  return {
    is_ready: false,
    detected_category,
    questions
  };
}
