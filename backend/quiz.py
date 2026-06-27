import os
import json
from groq import Groq
from rag_pipeline import get_top_chunks

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

QUIZ_PROMPT = """You are a quiz generator for college students.
Based ONLY on the following lecture notes, generate exactly 5 multiple-choice questions at {difficulty} difficulty level.

{difficulty_instruction}

Return ONLY valid JSON (no markdown, no commentary) in this exact format:
{{
  "questions": [
    {{
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correct_index": 0,
      "explanation": "string"
    }}
  ]
}}

Rules:
- "options" must have exactly 4 items
- "correct_index" is the 0-based index of the correct option
- "explanation" is 1-2 sentences explaining why the correct answer is right

Lecture notes:
{content}
"""

DIFFICULTY_INSTRUCTIONS = {
    "easy":   "Questions should test basic recall and simple understanding. Use straightforward language.",
    "medium": "Questions should test understanding and application of concepts. Mix recall and analytical questions.",
    "hard":   "Questions should test deep understanding, analysis, and application. Use nuanced options that require careful thinking.",
}

def generate_quiz(difficulty: str = "medium") -> dict:
    content = get_top_chunks(k=8)
    if not content.strip():
        return {"error": "No notes have been uploaded yet."}

    prompt = QUIZ_PROMPT.format(
        difficulty=difficulty,
        difficulty_instruction=DIFFICULTY_INSTRUCTIONS.get(difficulty, DIFFICULTY_INSTRUCTIONS["medium"]),
        content=content
    )

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.5,
    )

    try:
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"error": "Failed to parse quiz response."}
