exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
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
          error: "Problem must be 10–5000 characters.",
        }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL;

    if (!apiKey || !model) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "AI service configuration is missing.",
        }),
      };
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: "user",
              content: `Analyze this real-world problem. Explain its root causes, assumptions, three practical solution approaches, risks, and next steps. Do not invent facts or sources.\n\nProblem:\n${problem.trim()}`,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API request failed:", response.status);
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: "AI analysis service failed.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysis: data.output_text || "No analysis returned.",
      }),
    };
  } catch (error) {
    console.error("Analysis function failed:", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};
