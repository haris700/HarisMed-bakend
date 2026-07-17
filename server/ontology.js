// server/ontology.js

/**
 * HarisMed Deep Medical Ontology
 * Maps high-level user intents to specific medical markers, test types, and biological systems.
 * This allows the RAG engine to mathematically traverse the Knowledge Graph.
 */

export const MEDICAL_ONTOLOGY = {
  RENAL: {
    description: "Kidney function, filtration rate, and related waste products.",
    markers: ["creatinine", "bun", "egfr", "pcr", "acr", "urea", "uric acid"],
    related_tests: ["Blood Panel", "Urinalysis", "Urine Test", "Kidney Function Test"]
  },
  LIVER: {
    description: "Liver function, enzymes, and related proteins.",
    markers: ["alt", "ast", "alp", "bilirubin", "albumin", "total protein"],
    related_tests: ["Blood Panel", "Liver Function Test", "LFT", "Hepatic Panel"]
  },
  BLOOD: {
    description: "Red and white blood cell counts, platelets, and general blood health.",
    markers: ["rbc", "wbc", "hemoglobin", "hematocrit", "platelets"],
    related_tests: ["Blood Panel", "CBC", "Complete Blood Count"]
  },
  METABOLIC: {
    description: "Blood sugar, electrolytes, and metabolic health.",
    markers: ["glucose", "hba1c", "sodium", "potassium", "calcium", "chloride"],
    related_tests: ["Blood Panel", "Metabolic Panel", "BMP", "CMP"]
  }
};

/**
 * Helper function to retrieve the ontology context based on an intent
 */
export function getOntologyContext(intent) {
  const category = MEDICAL_ONTOLOGY[intent];
  if (!category) return "";

  return `
--- Deep Medical Ontology Context Activated ---
Category: ${intent}
Description: ${category.description}
Target Markers to Analyze: ${category.markers.join(", ")}
Target Test Types: ${category.related_tests.join(", ")}
`;
}
