exports.handler = async (event) => {
  // Allow POST requests only
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Allow": "POST" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("AI service is not configured");
    }

    const body = JSON.parse(event.body || "{}");
    const problem = body.problem;

    if (
      typeof problem !== "string" ||
      problem.trim().length < 10 ||
      problem.length > 5000
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Problem must be between 10 and 5000 characters."
        })
      };
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-6",
          instructions:
            "You are KAF-AI, the problem analysis engine of NEXUS. " +
            "Analyze problems carefully. Do not invent evidence or claim " +
            "that unverified solutions are proven. Return practical, " +
            "safe and realistic advice in clear language.",
          input:
            "Analyze this problem and provide: problem definition, " +
            "assumptions, three possible approaches with benefits, costs " +
            "and risks, and actionable next steps.\n\nProblem:\n" +
            problem.trim()
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("AI provider error:", response.status);

      return {
        statusCode: 502,
        body: JSON.stringify({
          error: "AI service request failed."
        })
      };
    }

    const analysis = (result.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n");

    if (!analysis) {
      throw new Error("Empty AI response");
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ analysis })
    };

  } catch (error) {
    console.error("KAF-AI error:", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Unable to analyze the problem right now."
      })
    };
  }
};
